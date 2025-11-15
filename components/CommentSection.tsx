import React, { useState, useEffect } from 'react';
import { type Comment, type AppUser } from '../types';
import { fetchComments, addComment } from '../services/firebase';
import { Spinner } from './Icons';

interface CommentSectionProps {
  postId: string;
  user: AppUser | null;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId, user }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const getComments = async () => {
      setIsLoading(true);
      try {
        const fetchedComments = await fetchComments(postId);
        setComments(fetchedComments);
      } catch (error) {
        console.error("Error fetching comments:", error);
      } finally {
        setIsLoading(false);
      }
    };
    getComments();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
        const addedComment = await addComment({
          body: newComment,
          authorId: user.uid,
          authorName: user.displayName || 'Anonymous',
          postId,
        });
        setComments(prev => [addedComment, ...prev]);
        setNewComment('');
    } catch (error) {
        console.error("Error adding comment:", error);
    } finally {
        setIsSubmitting(false);
    }
  };
  
  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <h4 className="text-lg font-semibold text-slate-800 mb-2">Comments</h4>
      {user && (
        <form onSubmit={handleSubmit} className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 border-slate-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 disabled:bg-emerald-400"
          >
            {isSubmitting ? '...' : 'Post'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner/></div>
      ) : comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map(comment => (
            <div key={comment.id} className="bg-slate-50 p-3 rounded-md">
              <p className="text-sm text-slate-800">{comment.body}</p>
              <p className="text-xs text-slate-500 mt-1">
                by {comment.authorName} on {comment.createdAt ? new Date(comment.createdAt.toDate()).toLocaleDateString() : 'Just now'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No comments yet.</p>
      )}
    </div>
  );
};

export default CommentSection;
