import React, { useState, useRef, useCallback } from 'react';
import Modal from './Modal';
import { type AppUser, type Post } from '../types';
import { createPost, uploadImage } from '../services/firebase';
import { generatePostTitle } from '../services/gemini';
import { Spinner } from './Icons';

interface CreatePostModalProps {
  user: AppUser;
  onClose: () => void;
  onPostCreated: (newPost: Post) => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ user, onClose, onPostCreated }) => {
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  
  const handleGenerateTitle = useCallback(async () => {
    if (!body || body.length < 20) {
      setError("Please write a bit more content (at least 20 characters) to generate a title.");
      return;
    }
    setError(null);
    setIsGeneratingTitle(true);
    try {
      const generatedTitle = await generatePostTitle(body);
      setTitle(generatedTitle);
    } catch (err) {
      console.error(err);
      setError("Failed to generate title.");
    } finally {
      setIsGeneratingTitle(false);
    }
  }, [body]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !title.trim()) {
      setError("Title and body cannot be empty.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      let imageUrl: string | undefined = undefined;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      
      const newPost = await createPost({
        title,
        body,
        imageUrl,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
      });
      
      onPostCreated(newPost);
    } catch (err) {
      console.error(err);
      setError("Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Create a New Post" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">Title</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              name="title"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus:ring-emerald-500 focus:border-emerald-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-slate-300"
              placeholder="Your post title"
              disabled={isSubmitting}
            />
            <button
                type="button"
                onClick={handleGenerateTitle}
                className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-50 text-slate-500 text-sm hover:bg-slate-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
                disabled={isSubmitting || isGeneratingTitle || !body}
              >
                {isGeneratingTitle ? <Spinner/> : 'Generate'}
              </button>
          </div>
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-medium text-slate-700">Body</label>
          <textarea
            id="body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
            placeholder="Share your story..."
            disabled={isSubmitting}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700">Image (Optional)</label>
          <div className="mt-1 flex items-center space-x-4">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-md" />
            ) : (
              <div className="h-16 w-16 bg-slate-100 rounded-md flex items-center justify-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white py-2 px-3 border border-slate-300 rounded-md shadow-sm text-sm leading-4 font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500">
              {imageFile ? 'Change' : 'Select'} Image
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:bg-emerald-400 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreatePostModal;
