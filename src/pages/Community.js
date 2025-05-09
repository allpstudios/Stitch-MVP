import React, { useState } from 'react';
import './Community.css';
import { FaPlus } from 'react-icons/fa';

const POST_CATEGORIES = [
  'Feed',
  'Request an Order',
  'Job Board'
];

const Community = () => {
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: "Sarah Chen",
      role: "Fashion Designer",
      content: "Just found an amazing dye house through Stitch! They handled my small batch perfectly. Highly recommend checking out ABC Dye House for startups.",
      timestamp: "2h ago",
      category: "Feed",
      likes: 24,
      comments: 5,
      tags: ["#dyehouse", "#smallbatch", "#manufacturing"]
    },
    {
      id: 2,
      author: "Emily Wong",
      role: "Brand Owner",
      content: "NEEDED: Looking for a manufacturer who can produce 100 hoodies with custom embroidery. Timeline: 3 weeks. Location: LA area. Budget: $25-30/piece. DM for details!",
      timestamp: "3h ago",
      category: "Request an Order",
      likes: 8,
      comments: 15,
      tags: ["#hoodies", "#embroidery", "#LA"]
    },
    {
      id: 3,
      author: "XYZ Printing",
      role: "Verified Vendor",
      content: "🔥 SPRING SPECIAL: 20% off all orders over 100 pieces! Free shipping on orders over $500. Valid until May 1st. DM for details.",
      timestamp: "4h ago",
      category: "Deals",
      likes: 45,
      comments: 12,
      tags: ["#deal", "#printing", "#spring2024"]
    },
    {
      id: 4,
      author: "Fashion District Manufacturing",
      role: "Verified Vendor",
      content: "Hiring experienced seamstresses! Full-time position, competitive pay, benefits included. Must have 3+ years experience with luxury garments. Send portfolio via DM.",
      timestamp: "1d ago",
      category: "Job Board",
      likes: 56,
      comments: 23,
      tags: ["#hiring", "#jobs", "#manufacturing"]
    },
    {
      id: 5,
      author: "John Martinez",
      role: "Pattern Maker",
      content: "Available for freelance pattern making work. 10+ years experience in women's wear. Portfolio available upon request. Based in downtown LA.",
      timestamp: "1d ago",
      category: "Job Board",
      likes: 34,
      comments: 8,
      tags: ["#freelance", "#patternmaker", "#available"]
    }
  ]);

  const [selectedCategories, setSelectedCategories] = useState(['Feed']);
  const [activeTab, setActiveTab] = useState('discussions');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postType, setPostType] = useState('Feed');

  const handleCategoryFilter = (category) => {
    let newCategories;
    if (selectedCategories.includes(category)) {
      newCategories = selectedCategories.filter(c => c !== category);
      if (newCategories.length === 0) {
        newCategories = ['Feed'];
      }
    } else {
      newCategories = [category];
    }
    setSelectedCategories(newCategories);
  };

  const filteredPosts = selectedCategories.includes('Feed')
    ? posts
    : posts.filter(post => selectedCategories.includes(post.category));

  return (
    <div className="community-page">
      <div className="community-header">
        <h1>Community</h1>
        <div className="post-button-container">
          <button 
            className="create-post-btn"
            onClick={() => setIsPostModalOpen(true)}
          >
            <FaPlus /> Create Post
          </button>
        </div>
      </div>

      {isPostModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create a Post</h2>
            <div className="form-group">
              <label>Post Type</label>
              <select 
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
              >
                <option value="Feed">Feed</option>
                <option value="Request an Order">Request an Order</option>
                <option value="Job Board">Job Board</option>
              </select>
            </div>
            {/* Rest of the form will go here */}
            <div className="modal-buttons">
              <button 
                type="button" 
                onClick={() => setIsPostModalOpen(false)}
                className="cancel"
              >
                Cancel
              </button>
              <button type="submit">Post</button>
            </div>
          </div>
        </div>
      )}

      <div className="community-content">
        {activeTab === 'discussions' && (
          <div className="discussions-section">
            <h2>Discussions</h2>
            <div className="feed-container">
              <div className="feed-filters">
                {POST_CATEGORIES.map(category => (
                  <button
                    key={category}
                    className={`filter-btn ${selectedCategories.includes(category) ? 'active' : ''}`}
                    onClick={() => handleCategoryFilter(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="posts-grid">
                {filteredPosts.map(post => (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="author-info">
                        <h3>{post.author}</h3>
                        <span className="role">{post.role}</span>
                      </div>
                      <span className="timestamp">{post.timestamp}</span>
                    </div>
                    
                    <div className="post-category">{post.category}</div>
                    <p className="post-content">{post.content}</p>
                    
                    <div className="post-tags">
                      {post.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>

                    <div className="post-actions">
                      <button className="like-btn">
                        <span>👍</span> {post.likes}
                      </button>
                      <button className="comment-btn">
                        <span>💬</span> {post.comments}
                      </button>
                      <button className="share-btn">
                        <span>↗️</span> Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'events' && (
          <div className="events-section">
            <h2>Events</h2>
            {/* Events content will go here */}
          </div>
        )}
      </div>
    </div>
  );
};

export default Community; 