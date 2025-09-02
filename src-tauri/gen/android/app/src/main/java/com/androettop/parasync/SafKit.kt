package com.androettop.parasync

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.documentfile.provider.DocumentFile
import java.io.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.io.DEFAULT_BUFFER_SIZE

class SafKit(private val activity: Activity) {
    companion object {
        private const val PREFS = "saf_prefs"
        private const val KEY_TREE_URI = "songs_tree_uri"

        fun getPersistedSongsUri(context: Context): String? =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_TREE_URI, null)
    }

    private var openTreeLauncher: ActivityResultLauncher<Uri?>? = null
    private var latch: CountDownLatch? = null
    private var lastResultUri: String? = null

    fun register(activity: Activity) {
        openTreeLauncher = (activity as? androidx.activity.ComponentActivity)
            ?.registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri: Uri? ->
                android.util.Log.d("SafKit", "onResult uri=" + (uri?.toString() ?: "null"))
                if (uri != null) {
                    lastResultUri = uri.toString() // ⚠️ setear ANTES de persistir
                    try {
                        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        activity.contentResolver.takePersistableUriPermission(uri, flags)
                        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .edit().putString(KEY_TREE_URI, uri.toString()).apply()
                        android.util.Log.d("SafKit", "persist OK")
                    } catch (e: Exception) {
                        android.util.Log.w("SafKit", "persist FAIL: " + e.message)
                        // IMPORTANTE: NO borres lastResultUri aquí; así el bloqueante puede devolverla.
                    }
                } else {
                    lastResultUri = null
                }
                android.util.Log.d("SafKit", "countDown latch")
                latch?.countDown()
            }
    }

    /**
     * Muestra el selector SAF y BLOQUEA hasta que el usuario elija o cancele.
     * Devuelve el URI persistido (content://...) o null.
     * IMPORTANTE: Llamar desde hilo de fondo (los commands de Tauri ya corren en background).
     */
    fun selectSongsDirBlocking(timeoutSeconds: Long = 120): String? {
        // prepara sincronización
        latch = CountDownLatch(1)
        lastResultUri = null

        activity.runOnUiThread {
            openTreeLauncher?.launch(null)
        }

        // espera resultado (con timeout defensivo)
        latch?.await(timeoutSeconds, TimeUnit.SECONDS)
        val out = lastResultUri
        latch = null
        return out
    }

    // ---------- COPY DIR appdir → SAF/songsFolder ----------

    /**
     * Copia todo el árbol de srcDirAbs hacia el árbol SAF dentro de <destFolderName>/...
     * Crea carpetas si faltan. Overwrite controla si reemplaza archivos existentes.
     */
    fun copyDirFromAppToSongs(srcDirAbs: String, destFolderName: String, overwrite: Boolean): Boolean {
        val tree = getPersistedSongsUri(activity) ?: return false
        val root = DocumentFile.fromTreeUri(activity, Uri.parse(tree)) ?: return false

        val srcRoot = File(srcDirAbs)
        if (!srcRoot.exists() || !srcRoot.isDirectory) return false

        // Asegura el folder base (destFolderName)
        val base = ensureDir(root, destFolderName) ?: return false

        val stack = ArrayDeque<File>()
        stack.add(srcRoot)

        while (stack.isNotEmpty()) {
            val cur = stack.removeFirst()

            if (cur.isDirectory) {
                val rel = srcRoot.toURI().relativize(cur.toURI()).path.trimEnd('/')
                val parent = if (rel.isEmpty()) base else ensureDir(base, rel) ?: return false
                // push hijos
                cur.listFiles()?.forEach { stack.add(it) }
            } else {
                val relPath = srcRoot.toURI().relativize(cur.toURI()).path // e.g. "charts/level.json"
                if (!copyOneFile(base, cur, relPath, overwrite)) return false
            }
        }
        return true
    }

    private fun ensureDir(root: DocumentFile, relPath: String): DocumentFile? {
        var dir = root
        for (seg in relPath.split('/').filter { it.isNotEmpty() }) {
            val existing = dir.findFile(seg)?.takeIf { it.isDirectory }
            dir = existing ?: (dir.createDirectory(seg) ?: return null)
        }
        return dir
    }

    private fun copyOneFile(base: DocumentFile, src: File, relPath: String, overwrite: Boolean): Boolean {
        val parts = relPath.split('/').filter { it.isNotEmpty() }
        val fileName = parts.last()
        val parentRel = parts.dropLast(1).joinToString("/")
        val parent = if (parentRel.isEmpty()) base else ensureDir(base, parentRel) ?: return false

        val existing = parent.findFile(fileName)
        val target = when {
            existing == null -> parent.createFile("application/octet-stream", fileName)
            overwrite -> existing
            else -> {
                // renombrar: name (1).ext
                val dot = fileName.lastIndexOf('.')
                val stem = if (dot > 0) fileName.substring(0, dot) else fileName
                val ext = if (dot > 0) fileName.substring(dot) else ""
                var i = 1
                var candidate: DocumentFile?
                do {
                    val alt = "$stem ($i)$ext"
                    candidate = parent.findFile(alt)
                    if (candidate == null) {
                        break
                    }
                    i++
                } while (true)
                parent.createFile("application/octet-stream", "$stem ($i)$ext")
            }
        } ?: return false

        activity.contentResolver.openOutputStream(target.uri, "rwt")?.use { os ->
            FileInputStream(src).use { fis ->
                val buf = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    val r = fis.read(buf)
                    if (r <= 0) break
                    os.write(buf, 0, r)
                }
                os.flush()
            }
        } ?: return false

        return true
    }

    // ---------- NEW: Helpers for I/O ----------

    private fun getRoot(): DocumentFile? {
        val tree = getPersistedSongsUri(activity) ?: return null
        return DocumentFile.fromTreeUri(activity, Uri.parse(tree))
    }

    private fun normalize(relPath: String): List<String> = relPath.trim('/').split('/').filter { it.isNotEmpty() }

    private fun resolve(relPath: String): DocumentFile? {
        var cur = getRoot() ?: return null
        val parts = normalize(relPath)
        if (parts.isEmpty()) return cur
        for (seg in parts) {
            cur = cur.findFile(seg) ?: return null
        }
        return cur
    }

    private fun resolveParentAndName(relPath: String): Pair<DocumentFile, String>? {
        val root = getRoot() ?: return null
        val parts = normalize(relPath)
        if (parts.isEmpty()) return null
        val name = parts.last()
        val parent = parts.dropLast(1).fold(root) { acc, seg ->
            acc.findFile(seg) ?: return null
        }
        return parent to name
    }

    private fun jsonEscape(s: String): String = s.replace("\\", "\\\\").replace("\"", "\\\"")

    // ---------- NEW: Public I/O API ----------

    fun listDirJson(relPath: String): String? {
        val dir = resolve(relPath) ?: return "[]"
        if (!dir.isDirectory) return "[]"
        val files = dir.listFiles()
        val sb = StringBuilder("[")
        files.forEachIndexed { idx, f ->
            if (idx > 0) sb.append(',')
            val name = f.name ?: ""
            sb.append("{\"name\":\"")
                .append(jsonEscape(name))
                .append("\",\"isFile\":")
                .append(if (f.isFile) "true" else "false")
                .append(",\"isDirectory\":")
                .append(if (f.isDirectory) "true" else "false")
                .append("}")
        }
        sb.append(']')
        return sb.toString()
    }

    fun readTextFile(relPath: String): String? {
        val file = resolve(relPath) ?: return null
        if (!file.isFile) return null
        activity.contentResolver.openInputStream(file.uri)?.use { ins ->
            return ins.bufferedReader(Charsets.UTF_8).readText()
        }
        return null
    }

    fun readFile(relPath: String): ByteArray? {
        val file = resolve(relPath) ?: return null
        if (!file.isFile) return null
        activity.contentResolver.openInputStream(file.uri)?.use { ins ->
            val bos = ByteArrayOutputStream()
            val buf = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val r = ins.read(buf)
                if (r <= 0) break
                bos.write(buf, 0, r)
            }
            return bos.toByteArray()
        }
        return null
    }

    fun removePath(relPath: String, recursive: Boolean): Boolean {
        val target = resolve(relPath) ?: return false
        return if (target.isFile) {
            target.delete()
        } else {
            if (!recursive) {
                target.delete()
            } else {
                deleteRecursively(target)
            }
        }
    }

    private fun deleteRecursively(dir: DocumentFile): Boolean {
        if (dir.isFile) return dir.delete()
        dir.listFiles().forEach { child ->
            if (child.isDirectory) {
                if (!deleteRecursively(child)) return false
            } else {
                if (!child.delete()) return false
            }
        }
        return dir.delete()
    }
}
