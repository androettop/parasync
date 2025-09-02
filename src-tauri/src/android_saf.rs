#[cfg(target_os = "android")]
pub mod android_saf {
    use jni::objects::{JClass, JObject, JString, JValue};
    use jni::sys::jbyteArray;
    use jni::JNIEnv;

    fn get_env_and_context<'a>() -> Option<(JNIEnv<'a>, JObject<'a>)> {
        // Use ndk-context to get a JavaVM and Context
        let ctx = ndk_context::android_context();
        let vm_ptr = ctx.vm().cast::<jni::sys::JavaVM>();
        let vm = unsafe { jni::JavaVM::from_raw(vm_ptr).ok()? };
        let env = vm.attach_current_thread().ok()?;
        // Recreate Context object from `ctx.context()` (JNI global ref)
        let ctx_obj = unsafe { JObject::from_raw(ctx.context() as *mut _) };
        Some((env, ctx_obj))
    }

    pub fn read_all_bytes(uri: &str) -> Option<Vec<u8>> {
        let (env, context) = get_env_and_context()?;
        let uri_js: JString = env.new_string(uri).ok()?;
        let class = env.find_class("com/androettop/parasync/SafKit").ok()?;
        let bytes = env
            .call_static_method(
                class,
                "readAllBytes",
                "(Landroid/content/Context;Ljava/lang/String;)[B",
                &[JValue::Object(&context), JValue::Object(&uri_js)],
            )
            .ok()?;
        let arr: jbyteArray = bytes.l().ok()?.into_inner();
        let out = env.convert_byte_array(arr).ok()?;
        Some(out)
    }

    pub fn list_children(uri: &str) -> Option<Vec<(String, bool)>> {
        let (env, context) = get_env_and_context()?;
        let uri_js: JString = env.new_string(uri).ok()?;
        let class = env.find_class("com/androettop/parasync/SafKit").ok()?;
        let arr_val = env
            .call_static_method(
                class,
                "listChildren",
                "(Landroid/content/Context;Ljava/lang/String;)[Ljava/lang/String;",
                &[JValue::Object(&context), JValue::Object(&uri_js)],
            )
            .ok()?;
        let arr_obj = arr_val.l().ok()?;
        let arr = jni::objects::JObjectArray::from(arr_obj);
        let len = env.get_array_length(arr).ok()?;
        let mut out = Vec::with_capacity(len as usize);
        for i in 0..len {
            let s_obj = env.get_object_array_element(arr, i).ok()?;
            let s: String = env.get_string(&JString::from(s_obj)).ok()?.into();
            let mut parts = s.split('\t');
            let name = parts.next().unwrap_or("").to_string();
            let is_dir = parts.next().unwrap_or("0") == "1";
            out.push((name, is_dir));
        }
        Some(out)
    }
}
