import { type User as FirebaseUser } from 'firebase/auth';
import { type Timestamp, GeoPoint } from 'firebase/firestore';

export type AppUser = Pick<FirebaseUser, 'uid' | 'email' | 'displayName'>;

export interface Post {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  loveCount: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  // FIX: Added postId to link comments to posts.
  postId: string;
}

export interface Lifetree {
    id: string;
    name: string;
    body: string;
    location: GeoPoint;
    authorId: string;
    authorName: string;
}