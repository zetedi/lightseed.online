import { initializeApp, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  type User 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
  where,
  type GeoPoint,
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import { type Post, type Comment, type Lifetree, type AppUser } from "../types";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const postsCollection = collection(db, "posts");
const commentsCollection = collection(db, "comments");
const lifetreesCollection = collection(db, "lifetrees");


export const onAuthChange = (callback: (user: AppUser | null) => void) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const { uid, email, displayName } = user;
      callback({ uid, email, displayName });
    } else {
      callback(null);
    }
  });
};

export const signInWithGoogle = async (): Promise<AppUser | null> => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const { uid, email, displayName } = result.user;
        return { uid, email, displayName };
    } catch (error) {
        console.error("Error signing in with Google:", error);
        return null;
    }
};

export const signOut = async (): Promise<void> => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error("Error signing out:", error);
    }
};

export const fetchPosts = async (): Promise<Post[]> => {
  const q = query(postsCollection, orderBy("createdAt", "desc"), limit(20));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
};


export const uploadImage = async (file: File): Promise<string> => {
  const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};

export const createPost = async (postData: { title: string; body: string; imageUrl?: string; authorId: string; authorName: string; }): Promise<Post> => {
  const docRef = await addDoc(postsCollection, {
    ...postData,
    createdAt: serverTimestamp(),
    loveCount: 0,
    commentCount: 0,
  });
  const newPostDoc = await getDoc(docRef);
  return { id: newPostDoc.id, ...newPostDoc.data() } as Post;
};

export const updateLove = async (postId: string, incrementValue: number): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
        loveCount: increment(incrementValue)
    });
};

export const fetchComments = async (postId: string): Promise<Comment[]> => {
    const q = query(commentsCollection, where("postId", "==", postId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
};

export const addComment = async (commentData: { body: string; authorId: string; authorName: string; postId: string; }): Promise<Comment> => {
    const postRef = doc(db, 'posts', commentData.postId);
    
    const docRef = await addDoc(commentsCollection, {
        ...commentData,
        createdAt: serverTimestamp(),
    });
    
    await updateDoc(postRef, {
        commentCount: increment(1)
    });

    const newCommentDoc = await getDoc(docRef);
    return { id: newCommentDoc.id, ...newCommentDoc.data() } as Comment;
};

export const saveLifetree = async (lifetreeData: {name: string; body: string; location: GeoPoint; authorId: string; authorName: string;}): Promise<Lifetree> => {
  const docRef = await addDoc(lifetreesCollection, {
    ...lifetreeData,
    createdAt: serverTimestamp(),
  });
  const newLifetreeDoc = await getDoc(docRef);
  return { id: newLifetreeDoc.id, ...newLifetreeDoc.data() } as Lifetree;
};

export const updateLifetree = async (id: string, lifetreeData: {name: string; body: string; location: GeoPoint;}): Promise<void> => {
    const treeRef = doc(db, 'lifetrees', id);
    await updateDoc(treeRef, lifetreeData);
};

export const fetchLifetrees = async (): Promise<Lifetree[]> => {
  const querySnapshot = await getDocs(lifetreesCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lifetree));
};

export const fetchUserLifetree = async (userId: string): Promise<Lifetree | null> => {
    const q = query(lifetreesCollection, where("authorId", "==", userId), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Lifetree;
};
