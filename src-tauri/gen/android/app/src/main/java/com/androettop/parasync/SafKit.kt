package com.androettop.parasync

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileInputStream
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
                if (uri != null) {
                    try {
                        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                        activity.contentResolver.takePersistableUriPermission(uri, flags)
                        // persistir
                        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                            .edit().putString(KEY_TREE_URI, uri.toString()).apply()
                        lastResultUri = uri.toString()
                    } catch (e: Exception) {
                        lastResultUri = null
                    }
                } else {
                    lastResultUri = null
                }
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
}
