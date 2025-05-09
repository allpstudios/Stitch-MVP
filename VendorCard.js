const DEBUG = true;

const uploadFile = async (file, path) => {
  if (DEBUG) {
    console.log('Upload attempt:', {
      file,
      path,
      auth: auth.currentUser?.uid,
      contentType: file.type
    });
  }
  
  try {
    const storage = getStorage();
    const storageRef = ref(storage, path);
    
    // Add metadata explicitly
    const metadata = {
      contentType: file.type,
    };
    
    if (DEBUG) console.log('Starting upload with metadata:', metadata);
    
    const uploadResult = await uploadBytes(storageRef, file, metadata);
    if (DEBUG) console.log('Upload successful:', uploadResult);
    
    const url = await getDownloadURL(uploadResult.ref);
    return url;
  } catch (error) {
    console.error('Detailed upload error:', {
      code: error.code,
      message: error.message,
      serverResponse: error.serverResponse
    });
    throw error;
  }
}; 