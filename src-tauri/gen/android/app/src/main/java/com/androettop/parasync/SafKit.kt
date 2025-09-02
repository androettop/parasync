package com.androettop.parasync

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
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
        val tree = getPersistedSongsUri(activity)
        if (tree == null) {
            Log.w("SafKit", "getRoot(): persisted tree URI is null")
            return null
        }
        Log.d("SafKit", "getRoot(): treeUri=$tree")
        val root = DocumentFile.fromTreeUri(activity, Uri.parse(tree))
        if (root == null) {
            Log.w("SafKit", "getRoot(): DocumentFile.fromTreeUri returned null")
        } else {
            Log.d("SafKit", "getRoot(): root.name=${root.name} uri=${root.uri}")
        }
        return root
    }

    private fun normalize(relPath: String): List<String> = relPath.trim('/').split('/').filter { it.isNotEmpty() }

    private fun resolve(relPath: String): DocumentFile? {
        Log.d("SafKit", "resolve(): relPath='$relPath'")
        var cur = getRoot() ?: run {
            Log.w("SafKit", "resolve(): root is null")
            return null
        }
        val parts = normalize(relPath)
        Log.d("SafKit", "resolve(): parts=$parts")
        if (parts.isEmpty()) {
            Log.d("SafKit", "resolve(): no parts -> returning root: uri=${cur.uri}")
            return cur
        }
        for (seg in parts) {
            Log.d("SafKit", "resolve(): finding seg='$seg' under uri=${cur.uri}")
            val next = cur.findFile(seg)
            if (next == null) {
                Log.w("SafKit", "resolve(): segment not found -> '$seg'")
                return null
            }
            Log.d("SafKit", "resolve(): found '$seg' -> uri=${next.uri} isDir=${next.isDirectory} isFile=${next.isFile}")
            cur = next
        }
        Log.d("SafKit", "resolve(): result uri=${cur.uri} isDir=${cur.isDirectory} isFile=${cur.isFile}")
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
        Log.d("SafKit", "listDirJson(): relPath='$relPath'")
        val dir = resolve(relPath) ?: run {
            Log.w("SafKit", "listDirJson(): resolve returned null for '$relPath'")
            return "[]"
        }
        if (!dir.isDirectory) {
            Log.w("SafKit", "listDirJson(): target is not a directory uri=${dir.uri}")
            return "[]"
        }
        val files = dir.listFiles()
        Log.d("SafKit", "listDirJson(): listing uri=${dir.uri} count=${files.size}")
        val sb = StringBuilder("[")
        files.forEachIndexed { idx, f ->
            if (idx > 0) sb.append(',')
            val name = f.name ?: ""
            if (idx < 10) { // limitar spam
                Log.d("SafKit", "listDirJson(): item[$idx] name='$name' isDir=${f.isDirectory} isFile=${f.isFile} uri=${f.uri}")
            }
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
        Log.d("SafKit", "readTextFile(): relPath='$relPath'")
        val file = resolve(relPath) ?: run {
            Log.w("SafKit", "readTextFile(): resolve returned null for '$relPath'")
            return null
        }
        if (!file.isFile) {
            Log.w("SafKit", "readTextFile(): target is not a file uri=${file.uri}")
            return null
        }
        activity.contentResolver.openInputStream(file.uri)?.use { ins ->
            return ins.bufferedReader(Charsets.UTF_8).readText()
        }
        Log.w("SafKit", "readTextFile(): openInputStream returned null uri=${file.uri}")
        return null
    }

    fun readFile(relPath: String): ByteArray? {
        Log.d("SafKit", "readFile(): relPath='$relPath'")
        val file = resolve(relPath) ?: run {
            Log.w("SafKit", "readFile(): resolve returned null for '$relPath'")
            return null
        }
        if (!file.isFile) {
            Log.w("SafKit", "readFile(): target is not a file uri=${file.uri}")
            return null
        }
        activity.contentResolver.openInputStream(file.uri)?.use { ins ->
            val bos = ByteArrayOutputStream()
            val buf = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val r = ins.read(buf)
                if (r <= 0) break
                bos.write(buf, 0, r)
            }
            Log.d("SafKit", "readFile(): read ${'$'}{bos.size()} bytes from uri=${file.uri}")
            return bos.toByteArray()
        }
        Log.w("SafKit", "readFile(): openInputStream returned null uri=${file.uri}")
        return null
    }

    fun removePath(relPath: String, recursive: Boolean): Boolean {
        Log.d("SafKit", "removePath(): relPath='$relPath' recursive=${'$'}recursive")
        val target = resolve(relPath) ?: run {
            Log.w("SafKit", "removePath(): resolve returned null for '$relPath'")
            return false
        }
        val ok = if (target.isFile) {
            val res = target.delete()
            Log.d("SafKit", "removePath(): delete file uri=${target.uri} -> ${'$'}res")
            res
        } else {
            if (!recursive) {
                val res = target.delete()
                Log.d("SafKit", "removePath(): delete dir (non-recursive) uri=${target.uri} -> ${'$'}res")
                res
            } else {
                val res = deleteRecursively(target)
                Log.d("SafKit", "removePath(): delete dir (recursive) uri=${target.uri} -> ${'$'}res")
                res
            }
        }
        return ok
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

    // ---------- NEW: COPY DIR SAF/<src> → app private dir ----------

    /**
     * Copia todo el árbol bajo SAF/<srcFolderRel> (o un archivo) hacia destAppDirAbs.
     * Crea carpetas si faltan. Overwrite controla si reemplaza archivos existentes.
     */
    fun copyDirFromSongsToApp(srcFolderRel: String, destAppDirAbs: String, overwrite: Boolean): Boolean {
        Log.d("SafKit", "copyDirFromSongsToApp(): src='$srcFolderRel' dest='$destAppDirAbs' overwrite=$overwrite")
        val src = resolve(srcFolderRel) ?: run {
            Log.w("SafKit", "copyDirFromSongsToApp(): source not found: '$srcFolderRel'")
            return false
        }

        val dest = File(destAppDirAbs)
        return if (src.isDirectory) {
            // For directories, ensure destination is a directory and copy the tree under it
            if (dest.exists()) {
                if (!dest.isDirectory) {
                    Log.w("SafKit", "copyDirFromSongsToApp(): dest exists and is not a directory: ${dest.absolutePath}")
                    return false
                }
            } else {
                if (!dest.mkdirs()) {
                    Log.w("SafKit", "copyDirFromSongsToApp(): cannot create dest dir: ${dest.absolutePath}")
                    return false
                }
            }
            copyDocumentTreeToDir(src, dest, "", overwrite)
        } else {
            // Single file: if dest is a directory or looks like one, copy inside using source name; otherwise copy to exact file path
            val targetFile = if (dest.isDirectory || destAppDirAbs.endsWith("/")) {
                File(dest, src.name ?: "unnamed")
            } else {
                dest
            }
            copyOneDocFile(src, targetFile, overwrite)
        }
    }

    private fun copyDocumentTreeToDir(srcDir: DocumentFile, destRoot: File, relBase: String, overwrite: Boolean): Boolean {
        // ensure current dest directory exists
        val curDest = if (relBase.isEmpty()) destRoot else File(destRoot, relBase)
        if (!curDest.exists() && !curDest.mkdirs()) {
            Log.w("SafKit", "copyDocumentTreeToDir(): cannot create dir ${curDest.absolutePath}")
            return false
        }
        srcDir.listFiles().forEach { child ->
            val name = child.name ?: return@forEach
            val childRel = if (relBase.isEmpty()) name else "$relBase/$name"
            if (child.isDirectory) {
                if (!copyDocumentTreeToDir(child, destRoot, childRel, overwrite)) return false
            } else {
                val target = File(destRoot, childRel)
                if (!copyOneDocFile(child, target, overwrite)) return false
            }
        }
        return true
    }

    private fun copyOneDocFile(srcDoc: DocumentFile, destFile: File, overwrite: Boolean): Boolean {
        // ensure parent
        destFile.parentFile?.let {
            if (!it.exists() && !it.mkdirs()) {
                Log.w("SafKit", "copyOneDocFile(): cannot create parent ${it.absolutePath}")
                return false
            }
        }

        var outFile = destFile
        if (outFile.exists()) {
            if (!overwrite) {
                // rename pattern: name (i).ext
                val fileName = outFile.name
                val dot = fileName.lastIndexOf('.')
                val stem = if (dot > 0) fileName.substring(0, dot) else fileName
                val ext = if (dot > 0) fileName.substring(dot) else ""
                var i = 1
                var candidate: File
                do {
                    candidate = File(outFile.parentFile, "$stem ($i)$ext")
                    if (!candidate.exists()) break
                    i++
                } while (true)
                outFile = candidate
            } else {
                // overwrite -> delete existing
                if (!outFile.delete()) {
                    Log.w("SafKit", "copyOneDocFile(): cannot delete existing ${outFile.absolutePath}")
                    return false
                }
            }
        }

        activity.contentResolver.openInputStream(srcDoc.uri)?.use { ins ->
            FileOutputStream(outFile).use { fos ->
                val buf = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    val r = ins.read(buf)
                    if (r <= 0) break
                    fos.write(buf, 0, r)
                }
                fos.flush()
            }
            Log.d("SafKit", "copyOneDocFile(): wrote ${outFile.absolutePath}")
            return true
        }
        Log.w("SafKit", "copyOneDocFile(): openInputStream null for uri=${srcDoc.uri}")
        return false
    }
}
