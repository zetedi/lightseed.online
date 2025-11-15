import React, { useState } from 'react';
import { type Post, type AppUser } from '../types';
import { HeartIcon, CommentIcon } from './Icons';
import CommentSection from './CommentSection';
import { updateLove } from '../services/firebase';

interface PostCardProps {
  post: Post;
  user: AppUser | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, user }) => {
    const [showComments, setShowComments] = useState(false);
    const [loveCount, setLoveCount] = useState(post.loveCount);
    const [isLoved, setIsLoved] = useState(false); // In a real app, this would be fetched per user

    const handleLoveClick = async () => {
        if (!user) return; // Or show login prompt
        const newIsLoved = !isLoved;
        setIsLoved(newIsLoved);
        
        const increment = newIsLoved ? 1 : -1;
        setLoveCount(prev => prev + increment);
        
        try {
            await updateLove(post.id, increment);
        } catch (error) {
            console.error("Failed to update love count:", error);
            // Revert optimistic update on failure
            setLoveCount(prev => prev - increment);
            setIsLoved(!newIsLoved);
        }
    };
    
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.title} className="w-full h-64 object-cover" />
      )}
      <div className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{post.title}</h2>
        <div className="text-sm text-slate-500 mb-4">
          <span>By {post.authorName}</span>
          <span className="mx-2">&middot;</span>
          <span>{post.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : ''}</span>
        </div>
        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{post.body}</p>
        
        <div className="flex items-center space-x-6 mt-6 pt-4 border-t border-slate-200">
            <button onClick={handleLoveClick} disabled={!user} className="flex items-center space-x-2 text-slate-600 hover:text-red-500 disabled:cursor-not-allowed disabled:hover:text-slate-600 transition-colors">
                <HeartIcon className={`w-6 h-6 ${isLoved ? 'text-red-500 fill-current' : ''}`} />
                <span>{loveCount}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} className="flex items-center space-x-2 text-slate-600 hover:text-emerald-700 transition-colors">
                <CommentIcon className="w-6 h-6" />
                <span>{post.commentCount}</span>
            </button>
        </div>

        {showComments && <CommentSection postId={post.id} user={user} />}
      </div>
    </div>
  );
};

export default PostCard;
