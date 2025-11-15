import React, { useState } from 'react';
import Modal from './Modal';
import { signInWithGoogle } from '../services/firebase';

interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    const user = await signInWithGoogle();
    if (user) {
      onClose();
    } else {
      setError("Failed to sign in. Please try again.");
    }
  };

  return (
    <Modal title="Join Lifetree" onClose={onClose}>
      <div className="text-center">
        <p className="text-slate-600 mb-6">
          Sign in to share your stories and connect with the community.
        </p>
        <button
          onClick={handleSignIn}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
          Sign in with Google
        </button>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>
    </Modal>
  );
};

export default AuthModal;
