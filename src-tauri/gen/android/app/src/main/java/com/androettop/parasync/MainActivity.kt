package com.androettop.parasync
import android.os.Bundle
import android.util.Log

class MainActivity : TauriActivity() {
    lateinit var safKit: SafKit

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        safKit = SafKit(this)
        safKit.register(this)
    Log.d("SafKit", "register() done")
    }

    // --- Métodos llamados desde Rust (JNI) ---

    /** Abre selector SAF y bloquea hasta resultado. Devuelve String? (content://...) */
    fun selectSongsDirBlocking(): String? {
    val res = safKit.selectSongsDirBlocking()
    Log.d("SafKit", "MainActivity.selectSongsDirBlocking -> ${'$'}res")
    return res
    }

    /** Devuelve el URI persistido o null si no hay. */
    fun getSongsDirPersisted(): String? {
    val res = SafKit.getPersistedSongsUri(this)
    Log.d("SafKit", "MainActivity.getSongsDirPersisted -> ${'$'}res")
    return res
    }

    /**
     * Copia todo appDirAbs (carpeta) a SAF/<destFolderName>
     * - appDirAbs: p.ej. "/data/data/tu.app/files/resources/MySong"
     * - destFolderName: p.ej. "MySong"
     */
    fun copyDirFromAppToSongs(appDirAbs: String, destFolderName: String, overwrite: Boolean): Boolean {
    Log.d("SafKit", "MainActivity.copyDirFromAppToSongs(appDir='${'$'}appDirAbs', dest='${'$'}destFolderName', overwrite=${'$'}overwrite)")
    val ok = safKit.copyDirFromAppToSongs(appDirAbs, destFolderName, overwrite)
    Log.d("SafKit", "MainActivity.copyDirFromAppToSongs -> ${'$'}ok")
    return ok
    }

    // --- NEW: SAF I/O exposed for Rust JNI ---

    fun safListDir(relPath: String): String? {
        Log.d("SafKit", "MainActivity.safListDir(relPath='${'$'}relPath')")
        val res = safKit.listDirJson(relPath)
        Log.d("SafKit", "MainActivity.safListDir -> ${'$'}res")
        return res
    }

    fun safReadTextFile(relPath: String): String? {
        Log.d("SafKit", "MainActivity.safReadTextFile(relPath='${'$'}relPath')")
        val res = safKit.readTextFile(relPath)
        Log.d("SafKit", "MainActivity.safReadTextFile -> len=${'$'}{res?.length ?: -1}")
        return res
    }

    fun safReadFile(relPath: String): ByteArray? {
        Log.d("SafKit", "MainActivity.safReadFile(relPath='${'$'}relPath')")
        val res = safKit.readFile(relPath)
        Log.d("SafKit", "MainActivity.safReadFile -> bytes=${'$'}{res?.size ?: -1}")
        return res
    }

    fun safRemove(relPath: String, recursive: Boolean): Boolean {
        Log.d("SafKit", "MainActivity.safRemove(relPath='${'$'}relPath', recursive=${'$'}recursive)")
        val ok = safKit.removePath(relPath, recursive)
        Log.d("SafKit", "MainActivity.safRemove -> ${'$'}ok")
        return ok
    }
}
