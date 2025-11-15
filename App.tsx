import React, { useState, useEffect, useCallback } from 'react';
import { Post, AppUser, Lifetree } from './types';
import { fetchPosts, onAuthChange } from './services/firebase';
import { useAuth } from './hooks/useAuth';

import Header from './components/Header';
import PostCard from './components/PostCard';
import AuthModal from './components/AuthModal';
import CreatePostModal from './components/CreatePostModal';
import MapModal from './components/MapModal';
import SaveLifetreeModal from './components/SaveLifetreeModal';

declare global {
  interface Window {
    google: any;
  }
}

export default function App() {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [saveLifetreeModalOpen, setSaveLifetreeModalOpen] = useState(false);

  useEffect(() => {
    const getPosts = async () => {
      try {
        setPostsLoading(true);
        const fetchedPosts = await fetchPosts();
        setPosts(fetchedPosts);
        setError(null);
      } catch (err) {
        console.error("Error fetching posts:", err);
        setError("Failed to load posts.");
      } finally {
        setPostsLoading(false);
      }
    };
    getPosts();
  }, []);

  const handlePostCreated = (newPost: Post) => {
    setPosts(prevPosts => [newPost, ...prevPosts]);
    setCreatePostModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-amber-50">
      <Header
        user={user}
        loading={loading}
        onLoginClick={() => setAuthModalOpen(true)}
        onCreatePostClick={() => setCreatePostModalOpen(true)}
        onMapClick={() => setMapModalOpen(true)}
        onMyLifetreeClick={() => setSaveLifetreeModalOpen(true)}
      />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {postsLoading ? (
             <div className="text-center py-10">
                <p className="text-emerald-800">Loading posts...</p>
             </div>
          ) : error ? (
            <div className="text-center py-10">
                <p className="text-red-500">{error}</p>
             </div>
          ) : posts.length > 0 ? (
            posts.map(post => (
              <PostCard key={post.id} post={post} user={user} />
            ))
          ) : (
            <div className="text-center py-10 bg-white rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-slate-700">No posts yet!</h3>
                <p className="text-slate-500 mt-2">Be the first to share something with the community.</p>
            </div>
          )}
        </div>
      </main>
      
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
      
      {user && createPostModalOpen && (
        <CreatePostModal 
          user={user}
          onClose={() => setCreatePostModalOpen(false)} 
          onPostCreated={handlePostCreated}
        />
      )}

      {user && mapModalOpen && (
        <MapModal 
          onClose={() => setMapModalOpen(false)} 
        />
      )}

      {user && saveLifetreeModalOpen && (
        <SaveLifetreeModal
          user={user}
          onClose={() => setSaveLifetreeModalOpen(false)}
        />
      )}
    </div>
  );
}
