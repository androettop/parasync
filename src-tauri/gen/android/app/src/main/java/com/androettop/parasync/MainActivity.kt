package com.androettop.parasync
import android.os.Bundle

class MainActivity : TauriActivity() {
    lateinit var safKit: SafKit

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        safKit = SafKit(this)
        safKit.register(this)
        android.util.Log.d("SafKit", "register() done")
    }

    // --- Métodos llamados desde Rust (JNI) ---

    /** Abre selector SAF y bloquea hasta resultado. Devuelve String? (content://...) */
    fun selectSongsDirBlocking(): String? {
        return safKit.selectSongsDirBlocking()
    }

    /** Devuelve el URI persistido o null si no hay. */
    fun getSongsDirPersisted(): String? {
        return SafKit.getPersistedSongsUri(this)
    }

    /**
     * Copia todo appDirAbs (carpeta) a SAF/<destFolderName>
     * - appDirAbs: p.ej. "/data/data/tu.app/files/resources/MySong"
     * - destFolderName: p.ej. "MySong"
     */
    fun copyDirFromAppToSongs(appDirAbs: String, destFolderName: String, overwrite: Boolean): Boolean {
        return safKit.copyDirFromAppToSongs(appDirAbs, destFolderName, overwrite)
    }
}
