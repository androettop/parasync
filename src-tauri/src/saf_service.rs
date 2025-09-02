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
