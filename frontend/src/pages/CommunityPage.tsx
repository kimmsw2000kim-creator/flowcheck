import React from 'react';
import { ThumbsUp, Share2, AlertCircle } from 'lucide-react';

interface Post {
  id: number;
  title: string;
  content: string;
  promoUrl: string;
  userId: string;
  email: string;
  likes: number;
  shares: number;
  createdAt: string;
}

interface Comment {
  id: number;
  postId: number;
  userId: string;
  author: string;
  content: string;
  parentId: number | null;
  createdAt: string;
}

interface CommunityPageProps {
  currentUser: {
    id: string;
    email: string;
  };
  posts: Post[];
  activePost: Post | { id: string } | null;
  setActivePost: (post: Post | { id: string } | null) => void;
  newPostTitle: string;
  setNewPostTitle: (t: string) => void;
  newPostContent: string;
  setNewPostContent: (c: string) => void;
  newPostPromoUrl: string;
  setNewPostPromoUrl: (u: string) => void;
  handleCreatePost: (e: React.FormEvent) => void;
  handleLikePost: (id: number) => void;
  handleSharePost: (id: number) => void;
  comments: Comment[];
  newCommentContent: string;
  setNewCommentContent: (c: string) => void;
  replyParentId: number | null;
  setReplyParentId: (id: number | null) => void;
  handleCreateComment: (e: React.FormEvent) => void;
  handleSubmitReport: (type: string, id: number) => void;
}

export default function CommunityPage({
  currentUser,
  posts,
  activePost,
  setActivePost,
  newPostTitle,
  setNewPostTitle,
  newPostContent,
  setNewPostContent,
  newPostPromoUrl,
  setNewPostPromoUrl,
  handleCreatePost,
  handleLikePost,
  handleSharePost,
  comments,
  newCommentContent,
  setNewCommentContent,
  replyParentId,
  setReplyParentId,
  handleCreateComment,
  handleSubmitReport
}: CommunityPageProps) {
  return (
    <div style={{ textAlign: 'left' }}>
      {activePost && activePost.id !== 'new' ? (
        // Post details with nested comments tree
        <div>
          <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setActivePost(null)}>
            &larr; Back to Board List
          </button>

          <div className="card">
            <div className="post-header">
              <span>By: {(activePost as Post).email}</span>
              <span>{(activePost as Post).createdAt}</span>
            </div>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>{(activePost as Post).title}</h2>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
              {(activePost as Post).content}
            </p>
            
            {(activePost as Post).promoUrl && (
              <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Promotion Link: <a href={(activePost as Post).promoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-hover)', fontFamily: 'var(--mono)' }}>{(activePost as Post).promoUrl}</a></span>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleSharePost((activePost as Post).id)}>
                  <Share2 size={14} /> Share Link
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <button className="post-action-btn" onClick={() => handleLikePost((activePost as Post).id)}>
                <ThumbsUp size={16} /> Like ({(activePost as Post).likes})
              </button>
              <button className="post-action-btn" onClick={() => handleSubmitReport('POST', (activePost as Post).id)}>
                <AlertCircle size={16} /> Report Post
              </button>
            </div>
          </div>

          {/* Comment Section */}
          <div className="comment-section">
            <h3>Feedback & Comments</h3>

            <form onSubmit={handleCreateComment} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <textarea 
                  className="form-input" 
                  placeholder={replyParentId ? "Type reply feedback..." : "Write UX feedback comment (First feedback comment grants 5,000 credits!)..."} 
                  value={newCommentContent} 
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  required
                ></textarea>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Post Feedback</button>
                {replyParentId && (
                  <button type="button" className="btn btn-secondary" onClick={() => setReplyParentId(null)}>Cancel Reply</button>
                )}
              </div>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {comments.filter(c => c.postId === (activePost as Post).id).map(c => (
                <div key={c.id}>
                  <div className={`comment-card ${c.parentId ? 'reply' : ''}`}>
                    <span className="comment-author">{c.author} {c.parentId && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(replied)</span>}</span>
                    <p className="comment-content">{c.content}</p>
                    <div className="comment-footer">
                      <span>{c.createdAt}</span>
                      {!c.parentId && (
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setReplyParentId(c.id)}>
                          Reply
                        </button>
                      )}
                      <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => handleSubmitReport('COMMENT', c.id)}>
                        Report
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (

        // Promo Board list
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem' }}>Promotional Feedback Board</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Promote your product and receive QA credits. First post grants 20,000 credits.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setActivePost({ id: 'new' })}>
              Create Promotion Post
            </button>
          </div>

          {activePost && activePost.id === 'new' ? (
            // Create post form
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Register New Promotional Post</h3>
              <form onSubmit={handleCreatePost}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input type="text" className="form-input" placeholder="Give your product introduction a title..." value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description & URL Link</label>
                  <input type="url" className="form-input" placeholder="Promotion Link (https://example.com)..." value={newPostPromoUrl} onChange={(e) => setNewPostPromoUrl(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Content details</label>
                  <textarea className="form-input" rows={6} placeholder="Introduce your site and request specific QA/UX feedback..." value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} required></textarea>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">Publish Post</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActivePost(null)}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="post-list">
              {posts.map(p => (
                <div className="post-card" key={p.id} onClick={() => setActivePost(p)}>
                  <div className="post-header">
                    <span>By: {p.email}</span>
                    <span>{p.createdAt}</span>
                  </div>
                  <h4 className="post-title">{p.title}</h4>
                  <p className="post-snippet">{p.content.substring(0, 150)}...</p>
                  <div className="post-actions">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ThumbsUp size={14} /> {p.likes} Likes</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Share2 size={14} /> {p.shares} Shares</span>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No posts registered yet. Be the first to promote!</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
