use once_cell::sync::Lazy;

pub static SAF: Lazy<SafService> = Lazy::new(SafService::new);

pub struct SafService;

impl SafService {
    fn new() -> Self { Self }

    pub fn select_songs_dir(&self) -> Result<Option<String>, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                let ret = env
                    .call_method(activity, "selectSongsDirBlocking", "()Ljava/lang/String;", &[])
                    .map_err(|e| format!("JNI call selectSongsDirBlocking: {e:?}"))?
                    .l()
                    .map_err(|e| format!("{e:?}"))?;

                if ret.is_null() {
                    Ok(None)
                } else {
                    use jni::objects::JString;
                    let jstr: JString = JString::from(ret);
                    let s: String = env
                        .get_string(&jstr)
                        .map_err(|e| format!("JNI get_string: {e:?}"))?
                        .into();
                    Ok(Some(s))
                }
            })
        }
        #[cfg(not(target_os = "android"))]
        { Ok(None) }
    }

    pub fn get_persisted_songs_dir(&self) -> Result<Option<String>, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                let ret = env
                    .call_method(activity, "getSongsDirPersisted", "()Ljava/lang/String;", &[])
                    .map_err(|e| format!("JNI call getSongsDirPersisted: {e:?}"))?
                    .l()
                    .map_err(|e| format!("{e:?}"))?;

                if ret.is_null() {
                    Ok(None)
                } else {
                    use jni::objects::JString;
                    let jstr: JString = JString::from(ret);
                    let s: String = env
                        .get_string(&jstr)
                        .map_err(|e| format!("JNI get_string: {e:?}"))?
                        .into();
                    Ok(Some(s))
                }
            })
        }
        #[cfg(not(target_os = "android"))]
        { Ok(None) }
    }

    pub fn copy_appdir_to_saf(
        &self,
        app_dir_abs: String,
        dest_folder_name: String,
        overwrite: bool,
    ) -> Result<bool, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                use jni::objects::JValue;

                let j_app  = env.new_string(app_dir_abs).map_err(|e| e.to_string())?;
                let j_dest = env.new_string(dest_folder_name).map_err(|e| e.to_string())?;

                let ok = env
                    .call_method(
                        activity,
                        "copyDirFromAppToSongs",
                        "(Ljava/lang/String;Ljava/lang/String;Z)Z",
                        &[
                            JValue::from(&j_app),
                            JValue::from(&j_dest),
                            JValue::from(overwrite),
                        ],
                    )
                    .map_err(|e| format!("JNI call copyDirFromAppToSongs: {e:?}"))?
                    .z()
                    .map_err(|e| format!("{e:?}"))?;

                Ok(ok)
            })
        }
        #[cfg(not(target_os = "android"))]
        { Ok(false) }
    }

    pub fn copy_saf_to_appdir(
        &self,
        src_folder_rel: String,
        dest_app_dir_abs: String,
        overwrite: bool,
    ) -> Result<bool, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                use jni::objects::JValue;

                let j_src = env.new_string(src_folder_rel).map_err(|e| e.to_string())?;
                let j_dst = env.new_string(dest_app_dir_abs).map_err(|e| e.to_string())?;

                let ok = env
                    .call_method(
                        activity,
                        "copyDirFromSongsToApp",
                        "(Ljava/lang/String;Ljava/lang/String;Z)Z",
                        &[
                            JValue::from(&j_src),
                            JValue::from(&j_dst),
                            JValue::from(overwrite),
                        ],
                    )
                    .map_err(|e| format!("JNI call copyDirFromSongsToApp: {e:?}"))?
                    .z()
                    .map_err(|e| format!("{e:?}"))?;

                Ok(ok)
            })
        }
        #[cfg(not(target_os = "android"))]
        { Ok(false) }
    }

    // --- NEW: SAF file operations (Android only) ---

    /// List a directory under the persisted SAF root. `path` is a relative path from the root.
    /// Returns a JSON array string of entries with fields: name, isFile, isDirectory
    pub fn read_dir(&self, path: String) -> Result<String, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                use jni::objects::JValue;
                let j_path = env.new_string(path).map_err(|e| e.to_string())?;
                let jres = env
                    .call_method(
                        activity,
                        "safListDir",
                        "(Ljava/lang/String;)Ljava/lang/String;",
                        &[JValue::from(&j_path)],
                    )
                    .map_err(|e| format!("JNI call safListDir: {e:?}"))?
                    .l()
                    .map_err(|e| format!("{e:?}"))?;
                if jres.is_null() {
                    Ok("[]".to_string())
                } else {
                    use jni::objects::JString;
                    let s: String = env
                        .get_string(&JString::from(jres))
                        .map_err(|e| format!("JNI get_string: {e:?}"))?
                        .into();
                    Ok(s)
                }
            })
        }
        #[cfg(not(target_os = "android"))]
        {
            Ok("[]".to_string())
        }
    }

    /// Read a UTF-8 text file under the SAF root.
    pub fn read_text_file(&self, path: String) -> Result<String, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                use jni::objects::JValue;
                let j_path = env.new_string(path).map_err(|e| e.to_string())?;
                let jres = env
                    .call_method(
                        activity,
                        "safReadTextFile",
                        "(Ljava/lang/String;)Ljava/lang/String;",
                        &[JValue::from(&j_path)],
                    )
                    .map_err(|e| format!("JNI call safReadTextFile: {e:?}"))?
                    .l()
                    .map_err(|e| format!("{e:?}"))?;
                if jres.is_null() {
                    Err("File not found".into())
                } else {
                    use jni::objects::JString;
                    let s: String = env
                        .get_string(&JString::from(jres))
                        .map_err(|e| format!("JNI get_string: {e:?}"))?
                        .into();
                    Ok(s)
                }
            })
        }
        #[cfg(not(target_os = "android"))]
        {
            Err("Not implemented on this platform".into())
        }
    }

    /// Read raw bytes from a file under the SAF root.
    pub fn read_file(&self, path: String) -> Result<Vec<u8>, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                use jni::objects::{JByteArray, JValue};
                let j_path = env.new_string(path).map_err(|e| e.to_string())?;
                let arr_obj = env
                    .call_method(
                        activity,
                        "safReadFile",
                        "(Ljava/lang/String;)[B",
                        &[JValue::from(&j_path)],
                    )
                    .map_err(|e| format!("JNI call safReadFile: {e:?}"))?
                    .l()
                    .map_err(|e| format!("{e:?}"))?;
                if arr_obj.is_null() {
                    Err("File not found".into())
                } else {
                    let jarr = JByteArray::from(arr_obj);
                    let data = env
                        .convert_byte_array(&jarr)
                        .map_err(|e| format!("convert_byte_array: {e:?}"))?;
                    Ok(data)
                }
            })
        }
        #[cfg(not(target_os = "android"))]
        {
            Err("Not implemented on this platform".into())
        }
    }

    /// Remove a file or directory under the SAF root. If directory and recursive=true, delete its contents.
    pub fn remove(&self, path: String, recursive: bool) -> Result<bool, String> {
        #[cfg(target_os = "android")]
        {
            android_sys::with_env_activity(|env, activity| {
                use jni::objects::JValue;
                let j_path = env.new_string(path).map_err(|e| e.to_string())?;
                let ok = env
                    .call_method(
                        activity,
                        "safRemove",
                        "(Ljava/lang/String;Z)Z",
                        &[JValue::from(&j_path), JValue::from(recursive)],
                    )
                    .map_err(|e| format!("JNI call safRemove: {e:?}"))?
                    .z()
                    .map_err(|e| format!("{e:?}"))?;
                Ok(ok)
            })
        }
        #[cfg(not(target_os = "android"))]
        {
            Ok(false)
        }
    }
}

#[cfg(target_os = "android")]
mod android_sys {
    use jni::{JNIEnv, JavaVM};
    use jni::objects::JObject;
    use ndk_context::android_context;

    /// Ejecuta `f` con (&mut JNIEnv, Activity as JObject)
    pub fn with_env_activity<F, T>(f: F) -> Result<T, String>
    where
        F: FnOnce(&mut JNIEnv, JObject) -> Result<T, String>,
    {
        let ctx = android_context();

        // Construye JavaVM desde puntero crudo
        let vm_ptr = ctx.vm() as *mut jni::sys::JavaVM;
        let vm = unsafe { JavaVM::from_raw(vm_ptr) }
            .map_err(|e| format!("JavaVM::from_raw: {e}"))?;

        // ¡Ojo! Necesitamos &mut JNIEnv
        let mut env = vm.attach_current_thread()
            .map_err(|e| format!("attach_current_thread: {e}"))?;

        // Activity actual como JObject
        let activity_obj = unsafe {
            JObject::from_raw(ctx.context() as jni::sys::jobject)
        };

        f(&mut env, activity_obj)
    }
}
