import React, { useState, useEffect } from 'react';
import { 
  Activity, Shield, CreditCard, Users, PlusCircle, CheckCircle, 
  AlertCircle, Play, Send, ThumbsUp, Share2, MessageSquare, 
  Trash2, TrendingUp, Settings, HelpCircle, Lock, RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState({
    id: 'f87a32d1-921c-4b9b-90f3-cb2071850123',
    email: 'corp-user@flowcheck.com',
    role: 'USER', // USER or ADMIN
    balance: 75000,
    status: 'ACTIVE',
    coupons: 3
  });

  // State elements
  const [domains, setDomains] = useState([
    { id: 1, domainUrl: 'https://myshop.com', verificationToken: 'overload-verify-da39a3ee5e6b4b0d3255bfef95601890afd80709', verified: true, createdAt: '2026-06-25' },
    { id: 2, domainUrl: 'https://testapp.io', verificationToken: 'overload-verify-7c5a0c3b9b8b7d6e5a4c3b2a1a', verified: false, createdAt: '2026-06-29' }
  ]);
  const [newDomainUrl, setNewDomainUrl] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Billing states
  const [billingAmount, setBillingAmount] = useState('50000');
  const [billingBank, setBillingBank] = useState('KB');
  const [billingName, setBillingName] = useState('강남길');
  const [activeOrder, setActiveOrder] = useState(null);
  const [ledger, setLedger] = useState([
    { id: 1, amount: 50000, type: 'CHARGE', description: 'Toss Payments Virtual Account Charge', createdAt: '2026-06-29 14:20' },
    { id: 2, amount: -30000, type: 'COUPON_BUY', description: 'Buy prepaid test coupons: 3 units', createdAt: '2026-06-29 14:30' },
    { id: 3, amount: 20000, type: 'PROMOTION', description: 'WELCOME2026', createdAt: '2026-06-30 09:00' }
  ]);
  const [promoCode, setPromoCode] = useState('');

  // QA states
  const [selectedQaDomain, setSelectedQaDomain] = useState(1);
  const [qaStatus, setQaStatus] = useState('idle'); // idle, running, success, failed
  const [qaSteps, setQaSteps] = useState([]);
  const [qaReportMarkdown, setQaReportMarkdown] = useState('');

  // Load testing states
  const [selectedLoadDomain, setSelectedLoadDomain] = useState(1);
  const [vusers, setVusers] = useState(100);
  const [duration, setDuration] = useState(30);
  const [loadPrompt, setLoadPrompt] = useState('Simulate multiple checkouts under extreme concurrency');
  const [loadStatus, setLoadStatus] = useState('idle'); // idle, running, success
  const [loadMetrics, setLoadMetrics] = useState(null);
  const [loadChartData, setLoadChartData] = useState([]);

  // Community states
  const [posts, setPosts] = useState([
    { id: 1, title: 'AI E-Commerce Checkout Optimization feedback wanted!', content: 'We built a checkout service using Gemini recommendations. We would love some load testing feedback or UI improvements.', promoUrl: 'https://myshop.com', userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', email: 'corp-user@flowcheck.com', likes: 12, shares: 4, createdAt: '2026-06-29' }
  ]);
  const [activePost, setActivePost] = useState(null);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostPromoUrl, setNewPostPromoUrl] = useState('');
  const [comments, setComments] = useState([
    { id: 1, postId: 1, userId: 'd290f1e2-b8b8-4d56-bc9b-3e5f6e872111', author: 'tester1@flowcheck.io', content: 'Crawl speed was perfect, but the checkout form did not validate input parameters correctly.', parentId: null, createdAt: '2026-06-29 18:00' }
  ]);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [replyParentId, setReplyParentId] = useState(null);

  // Admin states
  const [reports, setReports] = useState([
    { id: 1, reporterId: 'd290f1e2-b8b8-4d56-bc9b-3e5f6e872111', targetType: 'POST', targetId: 1, reason: 'Spam promotions', status: 'PENDING', createdAt: '2026-06-30' }
  ]);
  const [inquiries, setInquiries] = useState([
    { id: 1, userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', title: 'Payment Webhook Delay', content: 'I deposited 50,000 KRW to the virtual account, but it took 10 minutes to update.', status: 'PENDING', answer: null, createdAt: '2026-06-30' }
  ]);
  const [newInquiryTitle, setNewInquiryTitle] = useState('');
  const [newInquiryContent, setNewInquiryContent] = useState('');
  const [newAdminAnswer, setNewAdminAnswer] = useState('');
  const [dailyStats, setDailyStats] = useState([
    { date: '2026-06-24', totalUsers: 142, newUsers: 12, totalVerifiedDomains: 23, totalTestsRun: 110, totalCreditsConsumed: 450000, retentionRate7d: 38.5 },
    { date: '2026-06-25', totalUsers: 154, newUsers: 12, totalVerifiedDomains: 25, totalTestsRun: 125, totalCreditsConsumed: 520000, retentionRate7d: 41.2 },
    { date: '2026-06-26', totalUsers: 168, newUsers: 14, totalVerifiedDomains: 28, totalTestsRun: 140, totalCreditsConsumed: 600000, retentionRate7d: 40.8 },
    { date: '2026-06-27', totalUsers: 180, newUsers: 12, totalVerifiedDomains: 31, totalTestsRun: 165, totalCreditsConsumed: 580000, retentionRate7d: 42.5 },
    { date: '2026-06-28', totalUsers: 195, newUsers: 15, totalVerifiedDomains: 33, totalTestsRun: 190, totalCreditsConsumed: 700000, retentionRate7d: 44.1 },
    { date: '2026-06-29', totalUsers: 210, newUsers: 15, totalVerifiedDomains: 36, totalTestsRun: 210, totalCreditsConsumed: 850000, retentionRate7d: 45.0 }
  ]);

  // Notice banners
  const [alertMsg, setAlertMsg] = useState(null);

  const showAlert = (message, type = 'success') => {
    setAlertMsg({ message, type });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  // Switch role simulation
  const toggleRole = () => {
    const nextRole = currentUser.role === 'USER' ? 'ADMIN' : 'USER';
    setCurrentUser(prev => ({ ...prev, role: nextRole }));
    showAlert(`Switched simulation role to: ${nextRole}`, 'info');
  };

  // Add Domain
  const handleAddDomain = (e) => {
    e.preventDefault();
    if (!newDomainUrl) return;

    const newDom = {
      id: domains.length + 1,
      domainUrl: newDomainUrl,
      verificationToken: 'overload-verify-' + Math.random().toString(36).substring(2),
      verified: false,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setDomains([...domains, newDom]);
    setNewDomainUrl('');
    showAlert('Domain registered. Please insert the verification metadata token.');
  };

  // Verify Domain
  const handleVerifyDomain = async (id) => {
    setVerificationLoading(true);
    // Simulate backend delay
    setTimeout(() => {
      setDomains(domains.map(d => d.id === id ? { ...d, verified: true } : d));
      setVerificationLoading(false);
      showAlert('Domain verification completed successfully!');
    }, 1500);
  };

  // Toss payments order
  const handleCreateOrder = (e) => {
    e.preventDefault();
    const mockOrder = {
      id: 'ord-' + Math.floor(Math.random() * 1000000),
      amount: parseInt(billingAmount),
      bank: billingBank,
      accountNumber: '110-' + Math.floor(100000 + Math.random() * 900000) + '-12345',
      customerName: billingName,
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
    };
    setActiveOrder(mockOrder);
    showAlert('Virtual account order created successfully. Ready for deposit.');
  };

  // Deposit Webhook Simulation (Simulates Toss server webhook signal)
  const handleSimulateWebhook = () => {
    if (!activeOrder) return;
    
    // Lock balance addition
    setCurrentUser(prev => ({ ...prev, balance: prev.balance + activeOrder.amount }));
    setLedger([
      {
        id: ledger.length + 1,
        amount: activeOrder.amount,
        type: 'CHARGE',
        description: `Toss Payments Deposit Confirm - Order: ${activeOrder.id}`,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
      },
      ...ledger
    ]);
    setActiveOrder(null);
    showAlert('Webhook triggered! Deposit completed, balance credited.', 'success');
  };

  // Buy coupons
  const handleBuyCoupons = (count) => {
    const cost = count * 10000;
    if (currentUser.balance < cost) {
      showAlert('Insufficient credits.', 'error');
      return;
    }
    setCurrentUser(prev => ({ 
      ...prev, 
      balance: prev.balance - cost,
      coupons: prev.coupons + count
    }));
    setLedger([
      {
        id: ledger.length + 1,
        amount: -cost,
        type: 'COUPON_BUY',
        description: `Buy prepaid test coupons: ${count} units`,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
      },
      ...ledger
    ]);
    showAlert(`Successfully purchased ${count} prepaid test coupons!`);
  };

  // Promo Code
  const handleRedeemPromo = (e) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() !== 'WELCOME2026') {
      showAlert('Invalid promo code.', 'error');
      return;
    }
    // Check duplication
    const duplicate = ledger.some(l => l.type === 'PROMOTION' && l.description === 'WELCOME2026');
    if (duplicate) {
      showAlert('Promotion already claimed.', 'error');
      return;
    }
    setCurrentUser(prev => ({ ...prev, balance: prev.balance + 50000 }));
    setLedger([
      {
        id: ledger.length + 1,
        amount: 50000,
        type: 'PROMOTION',
        description: 'WELCOME2026',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
      },
      ...ledger
    ]);
    setPromoCode('');
    showAlert('Promo Code WELCOME2026 claimed! 50,000 credits added.', 'success');
  };

  // Run QA Crawl
  const handleRunQa = () => {
    // Check execution coupon/credits eligibility
    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('Insufficient coupons or balance. 10,000 credits required.', 'error');
      return;
    }

    if (currentUser.coupons > 0) {
      setCurrentUser(prev => ({ ...prev, coupons: prev.coupons - 1 }));
    } else {
      setCurrentUser(prev => ({ ...prev, balance: prev.balance - 10000 }));
      setLedger([
        { id: ledger.length + 1, amount: -10000, type: 'TEST_CONSUME', description: 'AI QA Test Execution', createdAt: new Date().toISOString().substring(0, 16) },
        ...ledger
      ]);
    }

    setQaStatus('running');
    setQaSteps([]);
    setQaReportMarkdown('');

    const targetUrl = domains.find(d => d.id === selectedQaDomain)?.domainUrl || 'https://myshop.com';

    // Steps timeline generation simulation
    const simulatedSteps = [
      { step: '1', url: targetUrl, selector: 'a.nav-link[href="/shop"]', action: 'CLICK', reason: 'Navigating to shop page.' },
      { step: '2', url: targetUrl + '/shop', selector: 'input#search', action: 'TYPE', text: 'Gemini CPU', reason: 'Typing search term.' },
      { step: '3', url: targetUrl + '/shop', selector: 'button.search-btn', action: 'CLICK', reason: 'Executing search query.' },
      { step: '4', url: targetUrl + '/shop?q=Gemini', selector: 'div.item-card:first-child a', action: 'CLICK', reason: 'Selecting search result.' },
      { step: '5', url: targetUrl + '/item/1', selector: 'button.add-to-cart', action: 'CLICK', reason: 'Adding item to cart.' }
    ];

    let delay = 0;
    simulatedSteps.forEach((step, index) => {
      setTimeout(() => {
        setQaSteps(prev => [...prev, step]);
        if (index === simulatedSteps.length - 1) {
          setQaStatus('success');
          setQaReportMarkdown(`# QA Audit Report for ${targetUrl}
## Summary of Findings
- **Crawl steps executed**: 5
- **Errors found**: 0
- **Page Load Speed**: Fast (Avg 240ms)

## Gemini Recommendations
1. **Accessibility**: The checkout button (\`button.checkout\`) lacks a descriptive \`aria-label\`.
2. **SEO**: Meta viewport tags are properly optimized.
3. **UX Improvement**: Add micro-interactions when clicking the "Add to Cart" button.`);
          showAlert('Autonomous AI QA Crawl Completed!', 'success');
        }
      }, delay += 1000);
    });
  };

  // Run Load Test
  const handleRunLoadTest = () => {
    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('Insufficient coupons or balance.', 'error');
      return;
    }

    if (currentUser.coupons > 0) {
      setCurrentUser(prev => ({ ...prev, coupons: prev.coupons - 1 }));
    } else {
      setCurrentUser(prev => ({ ...prev, balance: prev.balance - 10000 }));
      setLedger([
        { id: ledger.length + 1, amount: -10000, type: 'TEST_CONSUME', description: 'Locust Load Test Execution', createdAt: new Date().toISOString().substring(0, 16) },
        ...ledger
      ]);
    }

    setLoadStatus('running');
    setLoadMetrics(null);

    // Simulate duration countdown
    setTimeout(() => {
      const targetUrl = domains.find(d => d.id === selectedLoadDomain)?.domainUrl || 'https://myshop.com';
      setLoadStatus('success');
      setLoadMetrics({
        maxTps: vusers * 1.8,
        avgResponse: 120 + (vusers * 0.4),
        errorRate: vusers > 200 ? 4.8 : 0.0,
        bottleneckDiagnosis: `# Bottleneck Analysis for ${targetUrl}
- **High Concurrency Behavior**: Under ${vusers} VUsers, API server shows CPU utilization spike (92%).
- **Database Recommendation**: Add query optimization indexes on \`orders\` tables.
- **Auto-scaling Recommendation**: Configure container scale-out triggering when CPU exceeds 75%.`
      });

      // Generate timeseries data
      const points = [];
      const now = Math.floor(Date.now() / 1000);
      for (let i = 0; i <= duration; i += 3) {
        points.push({
          time: `${i}s`,
          users: Math.min(vusers, Math.floor((i / duration) * vusers * 1.5)),
          tps: Math.floor((vusers * 1.5) * 0.7 + (Math.random() * vusers * 0.5)),
          avg_response: Math.floor((120 + (vusers * 0.3)) * 0.9 + (Math.random() * 40))
        });
      }
      setLoadChartData(points);
      showAlert('Locust load testing completed!', 'success');
    }, 3000);
  };

  // Create Community Post
  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;

    // Check duplicate post activity
    const duplicate = posts.some(p => p.userId === currentUser.id);

    const newPost = {
      id: posts.length + 1,
      title: newPostTitle,
      content: newPostContent,
      promoUrl: newPostPromoUrl,
      userId: currentUser.id,
      email: currentUser.email,
      likes: 0,
      shares: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setPosts([newPost, ...posts]);
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostPromoUrl('');

    // Reward for first post
    if (!duplicate) {
      setCurrentUser(prev => ({ ...prev, balance: prev.balance + 20000 }));
      setLedger([
        { id: ledger.length + 1, amount: 20000, type: 'REWARD_POST', description: 'Promo board signup reward', createdAt: new Date().toISOString().substring(0, 16) },
        ...ledger
      ]);
      showAlert('First promo post registered! 20,000 credits rewarded!', 'success');
    } else {
      showAlert('Promo post registered successfully.');
    }
  };

  // Like post
  const handleLikePost = (postId) => {
    // Check abuse block
    const actType = 'LIKE';
    const isAbused = ledger.some(l => l.type === 'REWARD_LIKE' && l.description.includes(`Post: ${postId}`));
    if (isAbused) {
      showAlert('You have already liked this post. Duplicate reward blocked.', 'warning');
      return;
    }

    setPosts(posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    setCurrentUser(prev => ({ ...prev, balance: prev.balance + 1000 }));
    setLedger([
      { id: ledger.length + 1, amount: 1000, type: 'REWARD_LIKE', description: `Post: ${postId} like reward`, createdAt: new Date().toISOString().substring(0, 16) },
      ...ledger
    ]);
    showAlert('Post liked! 1,000 credits rewarded.', 'success');
  };

  // Share post
  const handleSharePost = (postId) => {
    const isAbused = ledger.some(l => l.type === 'REWARD_SHARE' && l.description.includes(`Post: ${postId}`));
    if (isAbused) {
      showAlert('You have already shared this post. Duplicate reward blocked.', 'warning');
      return;
    }

    setPosts(posts.map(p => p.id === postId ? { ...p, shares: p.shares + 1 } : p));
    setCurrentUser(prev => ({ ...prev, balance: prev.balance + 2000 }));
    setLedger([
      { id: ledger.length + 1, amount: 2000, type: 'REWARD_SHARE', description: `Post: ${postId} share reward`, createdAt: new Date().toISOString().substring(0, 16) },
      ...ledger
    ]);
    showAlert('Post shared! 2,000 credits rewarded.', 'success');
  };

  // Comment submit
  const handleCreateComment = (e) => {
    e.preventDefault();
    if (!newCommentContent) return;

    const duplicateCommentReward = ledger.some(l => l.type === 'REWARD_COMMENT' && l.description.includes(`Post: ${activePost.id}`));

    const newComment = {
      id: comments.length + 1,
      postId: activePost.id,
      userId: currentUser.id,
      author: currentUser.email,
      content: newCommentContent,
      parentId: replyParentId,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setComments([...comments, newComment]);
    setNewCommentContent('');
    setReplyParentId(null);

    // Comment reward
    if (!duplicateCommentReward) {
      setCurrentUser(prev => ({ ...prev, balance: prev.balance + 5000 }));
      setLedger([
        { id: ledger.length + 1, amount: 5000, type: 'REWARD_COMMENT', description: `First feedback comment reward for Post: ${activePost.id}`, createdAt: new Date().toISOString().substring(0, 16) },
        ...ledger
      ]);
      showAlert('Feedback comment posted! 5,000 credits rewarded!', 'success');
    } else {
      showAlert('Comment posted successfully.');
    }
  };

  // Submit report
  const handleSubmitReport = (type, targetId) => {
    const report = {
      id: reports.length + 1,
      reporterId: currentUser.id,
      targetType: type,
      targetId: targetId,
      reason: 'Inappropriate promo content or spam',
      status: 'PENDING',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setReports([...reports, report]);
    showAlert('Abuse report submitted. Administrators will review.');
  };

  // Submit Inquiry
  const handleCreateInquiry = (e) => {
    e.preventDefault();
    if (!newInquiryTitle || !newInquiryContent) return;

    const inquiry = {
      id: inquiries.length + 1,
      userId: currentUser.id,
      title: newInquiryTitle,
      content: newInquiryContent,
      status: 'PENDING',
      answer: null,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setInquiries([...inquiries, inquiry]);
    setNewInquiryTitle('');
    setNewInquiryContent('');
    showAlert('Support inquiry submitted successfully.');
  };

  // Admin: Suspend User
  const handleSuspendUser = (targetUserId) => {
    showAlert(`User ${targetUserId} suspended for 7 days.`, 'success');
  };

  // Admin: Answer CS
  const handleAnswerInquiry = (id) => {
    if (!newAdminAnswer) return;
    setInquiries(inquiries.map(inq => inq.id === id ? { ...inq, status: 'ANSWERED', answer: newAdminAnswer } : inq));
    setNewAdminAnswer('');
    showAlert('Inquiry reply posted.');
  };

  return (
    <div className="app-container">
      {/* Top Banner Alerts */}
      {alertMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: alertMsg.type === 'error' ? 'var(--error-bg)' : 
                           alertMsg.type === 'warning' ? 'var(--warning-bg)' : 'var(--bg-secondary)',
          color: alertMsg.type === 'error' ? 'var(--error)' :
                 alertMsg.type === 'warning' ? 'var(--warning)' : 'var(--success)',
          padding: '1rem 1.5rem',
          borderRadius: '0.5rem',
          border: `1px solid ${alertMsg.type === 'error' ? 'var(--error)' : 'var(--success)'}`,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: 'var(--card-shadow)',
          backdropFilter: 'blur(8px)'
        }}>
          {alertMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{alertMsg.message}</span>
        </div>
      )}

      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">
          <Activity size={24} />
          <span>FlowCheck</span>
        </div>
        <div className="nav-links">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setActivePost(null); }}>Dashboard</button>
          <button className={`nav-item ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => { setActiveTab('domains'); setActivePost(null); }}>Domains</button>
          <button className={`nav-item ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => { setActiveTab('qa'); setActivePost(null); }}>AI QA</button>
          <button className={`nav-item ${activeTab === 'load' ? 'active' : ''}`} onClick={() => { setActiveTab('load'); setActivePost(null); }}>Load Testing</button>
          <button className={`nav-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => { setActiveTab('billing'); setActivePost(null); }}>Billing</button>
          <button className={`nav-item ${activeTab === 'community' ? 'active' : ''}`} onClick={() => { setActiveTab('community'); }}>Community</button>
          <button className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => { setActiveTab('admin'); setActivePost(null); }}>Admin & CS</button>
        </div>
        <div className="user-profile">
          <span style={{ color: 'var(--text-secondary)' }}>{currentUser.email}</span>
          <span className="role-badge">{currentUser.role}</span>
          <button onClick={toggleRole} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '1rem' }}>
            Sim Role
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        
        {/* TABS 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ textAlign: 'left', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome to FlowCheck Dashboard</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Monitor credits, run QA sweeps, and evaluate load tests.</p>
            </div>
            
            <div className="dashboard-grid">
              <div className="card">
                <div className="card-title"><CreditCard size={18} /> Credit Balance</div>
                <div className="card-value" style={{ color: 'var(--accent-hover)' }}>
                  {currentUser.balance.toLocaleString()} <span style={{ fontSize: '1rem' }}>credits</span>
                </div>
              </div>
              <div className="card">
                <div className="card-title"><PlusCircle size={18} /> Prepaid Coupons</div>
                <div className="card-value">{currentUser.coupons} <span style={{ fontSize: '1rem' }}>runs left</span></div>
              </div>
              <div className="card">
                <div className="card-title"><Shield size={18} /> Registered Domains</div>
                <div className="card-value">
                  {domains.length} <span style={{ fontSize: '1.2rem', color: 'var(--success)' }}>({domains.filter(d => d.verified).length} verified)</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '2rem', textAlign: 'left' }}>
              <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Active Verified Target Websites</h3>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Domain Host URL</th>
                      <th>Registered At</th>
                      <th>Status</th>
                      <th>QA Tests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontFamily: 'var(--mono)' }}>{d.domainUrl}</td>
                        <td>{d.createdAt}</td>
                        <td>
                          <span className={`badge ${d.verified ? 'badge-success' : 'badge-pending'}`}>
                            {d.verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => { setActiveTab('qa'); setSelectedQaDomain(d.id); }}
                          >
                            Launch QA
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TABS 2: DOMAINS */}
        {activeTab === 'domains' && (
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Domain Ownership Verification</h2>
            
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Register New Site</h3>
              <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://mybusiness.com" 
                  value={newDomainUrl} 
                  onChange={(e) => setNewDomainUrl(e.target.value)} 
                  required 
                />
                <button type="submit" className="btn btn-primary">Add Domain</button>
              </form>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Ownership Verification List</h3>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Host URL</th>
                      <th>Verification Meta Tag / Text File Content</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{d.domainUrl}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Registered: {d.createdAt}</div>
                        </td>
                        <td>
                          {d.verified ? (
                            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle size={16} /> Verification Active
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ fontSize: '0.85rem' }}>
                                Add to website head:<br/>
                                <code style={{ fontSize: '0.8rem' }}>&lt;meta name="overload-verification" content="{d.verificationToken}"&gt;</code>
                              </div>
                              <div style={{ fontSize: '0.85rem' }}>
                                Or host txt file at:<br/>
                                <code style={{ fontSize: '0.8rem' }}>{d.domainUrl}/.well-known/overload-verification.txt</code> contains <code>{d.verificationToken}</code>
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          {d.verified ? (
                            <span className="badge badge-success">Verified</span>
                          ) : (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                              onClick={() => handleVerifyDomain(d.id)}
                              disabled={verificationLoading}
                            >
                              {verificationLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Verify Now'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TABS 3: QA EXPLORER */}
        {activeTab === 'qa' && (
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>AI Autonomous QA Explorer (Playwright + Gemini)</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              <div>
                <div className="card">
                  <h3 style={{ marginBottom: '1.25rem' }}>Trigger AI QA Crawl</h3>
                  
                  <div className="form-group">
                    <label className="form-label">Select Verified Domain</label>
                    <select 
                      className="form-input" 
                      value={selectedQaDomain} 
                      onChange={(e) => setSelectedQaDomain(parseInt(e.target.value))}
                    >
                      {domains.filter(d => d.verified).map(d => (
                        <option key={d.id} value={d.id}>{d.domainUrl}</option>
                      ))}
                      {domains.filter(d => !d.verified).length > 0 && (
                        <optgroup label="Unverified (Requires verification)">
                          {domains.filter(d => !d.verified).map(d => (
                            <option key={d.id} value={d.id} disabled>{d.domainUrl}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    <p>⚡ Costs: <strong>1 prepaid coupon</strong> or <strong>10,000 credits</strong>.</p>
                    <p>🔄 Playwright crawls interactive elements automatically up to 10-20 steps.</p>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                    onClick={handleRunQa}
                    disabled={qaStatus === 'running'}
                  >
                    {qaStatus === 'running' ? 'Crawl Running...' : 'Execute QA Test'}
                  </button>
                </div>
              </div>

              <div>
                <div className="card" style={{ minHeight: '400px' }}>
                  <h3 style={{ marginBottom: '1.25rem' }}>Crawl Execution Telemetry</h3>
                  
                  {qaStatus === 'idle' && (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '5rem' }}>
                      <Play size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                      <p>Trigger a QA crawl to view real-time DOM exploration steps.</p>
                    </div>
                  )}

                  {qaStatus === 'running' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-hover)', marginBottom: '1rem' }}>
                        <RefreshCw className="animate-spin" size={18} />
                        <span>Gemini and Playwright are exploring DOM structures...</span>
                      </div>
                      <div className="timeline">
                        {qaSteps.map((step, idx) => (
                          <div className="timeline-step" key={idx}>
                            <div className="timeline-dot"></div>
                            <div className="timeline-header">
                              <span className="timeline-action">Step {step.step}: {step.action}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{step.url}</span>
                            </div>
                            <div className="timeline-desc">
                              <strong>Selector</strong>: <code>{step.selector}</code> {step.text && <span>| <strong>Input</strong>: "{step.text}"</span>}<br/>
                              <strong>Reasoning</strong>: {step.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {qaStatus === 'success' && (
                    <div>
                      <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <CheckCircle size={18} />
                        <span>AI QA Crawl completed successfully!</span>
                      </div>
                      <div className="markdown-body" style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{qaReportMarkdown}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABS 4: LOAD TESTER */}
        {activeTab === 'load' && (
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Locust Intelligent Load Testing Engine</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '2rem' }}>
              <div>
                <div className="card">
                  <h3 style={{ marginBottom: '1.25rem' }}>Configure Load Test</h3>

                  <div className="form-group">
                    <label className="form-label">Target Website</label>
                    <select 
                      className="form-input" 
                      value={selectedLoadDomain} 
                      onChange={(e) => setSelectedLoadDomain(parseInt(e.target.value))}
                    >
                      {domains.filter(d => d.verified).map(d => (
                        <option key={d.id} value={d.id}>{d.domainUrl}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Virtual Users (VUsers): {vusers}</label>
                    <input 
                      type="range" 
                      min="10" 
                      max="500" 
                      step="10"
                      value={vusers} 
                      onChange={(e) => setVusers(parseInt(e.target.value))}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Test Duration: {duration} seconds</label>
                    <input 
                      type="range" 
                      min="10" 
                      max="120" 
                      step="10"
                      value={duration} 
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Scenario Prompt Requirements</label>
                    <textarea 
                      className="form-input" 
                      rows="3" 
                      value={loadPrompt}
                      onChange={(e) => setLoadPrompt(e.target.value)}
                    ></textarea>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '1rem' }}
                    onClick={handleRunLoadTest}
                    disabled={loadStatus === 'running'}
                  >
                    {loadStatus === 'running' ? 'Running Load Test...' : 'Generate & Run Test'}
                  </button>
                </div>
              </div>

              <div>
                <div className="card" style={{ minHeight: '400px' }}>
                  <h3 style={{ marginBottom: '1.25rem' }}>Telemetry Metrics & Charts</h3>

                  {loadStatus === 'idle' && (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '6rem' }}>
                      <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                      <p>Locust script will be dynamically generated by Gemini and executed headlessly.</p>
                    </div>
                  )}

                  {loadStatus === 'running' && (
                    <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
                      <RefreshCw className="animate-spin" size={40} style={{ margin: '0 auto 1.5rem', color: 'var(--accent)' }} />
                      <p>Gemini generating `locustfile.py` and running traffic simulation...</p>
                    </div>
                  )}

                  {loadStatus === 'success' && loadMetrics && (
                    <div>
                      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Max TPS</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{loadMetrics.maxTps.toFixed(1)} req/s</div>
                        </div>
                        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avg Response Time</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{loadMetrics.avgResponse.toFixed(0)} ms</div>
                        </div>
                        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Error Rate</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: loadMetrics.errorRate > 0 ? 'var(--error)' : 'var(--success)' }}>
                            {loadMetrics.errorRate.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {/* Line Chart */}
                      <div style={{ height: '300px', width: '100%', marginBottom: '2rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={loadChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="time" stroke="var(--text-muted)" />
                            <YAxis yAxisId="left" stroke="var(--accent)" />
                            <YAxis yAxisId="right" orientation="right" stroke="var(--success)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="avg_response" name="Response Time (ms)" stroke="var(--accent)" activeDot={{ r: 8 }} />
                            <Line yAxisId="right" type="monotone" dataKey="tps" name="TPS (req/s)" stroke="var(--success)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="markdown-body" style={{ background: 'var(--bg-tertiary)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{loadMetrics.bottleneckDiagnosis}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABS 5: BILLING */}
        {activeTab === 'billing' && (
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Credits Billing & Payment</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
              <div>
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>1. Charge Credits (Toss Payments Virtual Account)</h3>
                  
                  <form onSubmit={handleCreateOrder}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                      <button 
                        type="button" 
                        className={`btn ${billingAmount === '10000' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setBillingAmount('10000')}
                      >
                        10,000 KRW
                      </button>
                      <button 
                        type="button" 
                        className={`btn ${billingAmount === '50000' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setBillingAmount('50000')}
                      >
                        50,000 KRW
                      </button>
                      <button 
                        type="button" 
                        className={`btn ${billingAmount === '100000' ? 'btn-primary' : 'btn-secondary'}`} 
                        onClick={() => setBillingAmount('100000')}
                      >
                        100,000 KRW
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Depositor Name</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={billingName} 
                        onChange={(e) => setBillingName(e.target.value)} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Preferred Bank</label>
                      <select 
                        className="form-input" 
                        value={billingBank} 
                        onChange={(e) => setBillingBank(e.target.value)}
                      >
                        <option value="KB">국민은행 (KB)</option>
                        <option value="SHINHAN">신한은행</option>
                        <option value="WOORI">우리은행</option>
                        <option value="TOSS">토스뱅크</option>
                      </select>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Request Virtual Account
                    </button>
                  </form>

                  {activeOrder && (
                    <div style={{ 
                      marginTop: '1.5rem', 
                      background: 'var(--bg-tertiary)', 
                      padding: '1.25rem', 
                      borderRadius: '0.5rem',
                      border: '1px dashed var(--accent-border)'
                    }}>
                      <h4 style={{ color: 'var(--accent-hover)', marginBottom: '0.75rem', fontWeight: 600 }}>Toss Virtual Account Issued</h4>
                      <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Bank: <strong>{activeOrder.bank}</strong></p>
                      <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Account No: <strong>{activeOrder.accountNumber}</strong></p>
                      <p style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Amount: <strong>{activeOrder.amount.toLocaleString()} KRW</strong></p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Due Date: {activeOrder.dueDate}</p>
                      
                      <button className="btn btn-success" style={{ width: '100%' }} onClick={handleSimulateWebhook}>
                        Simulate Deposit Webhook
                      </button>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>2. Purchase Prepaid Test Coupon Packages</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', borderStyle: 'dashed' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>5 Runs Pack</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Cost: 50,000 credits</div>
                      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(5)}>Buy Pack</button>
                    </div>
                    <div className="card" style={{ background: 'var(--bg-tertiary)', textAlign: 'center', borderStyle: 'dashed' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>10 Runs Pack</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>Cost: 100,000 credits</div>
                      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleBuyCoupons(10)}>Buy Pack</button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Event Promo Coupon Code</h3>
                  <form onSubmit={handleRedeemPromo} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="WELCOME2026" 
                      value={promoCode} 
                      onChange={(e) => setPromoCode(e.target.value)} 
                      required 
                    />
                    <button type="submit" className="btn btn-primary">Apply</button>
                  </form>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>Credits Transaction Ledger</h3>
                  <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Flow</th>
                          <th>Adjustment</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map(l => (
                          <tr key={l.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{l.type}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{l.description}</div>
                            </td>
                            <td style={{ color: l.amount > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                              {l.amount > 0 ? '+' : ''}{l.amount.toLocaleString()}
                            </td>
                            <td>{l.createdAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABS 6: COMMUNITY */}
        {activeTab === 'community' && (
          <div style={{ textAlign: 'left' }}>
            
            {activePost ? (
              // Post details with nested comments tree
              <div>
                <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setActivePost(null)}>
                  &larr; Back to Board List
                </button>

                <div className="card">
                  <div className="post-header">
                    <span>By: {activePost.email}</span>
                    <span>{activePost.createdAt}</span>
                  </div>
                  <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>{activePost.title}</h2>
                  <p style={{ fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
                    {activePost.content}
                  </p>
                  
                  {activePost.promoUrl && (
                    <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Promotion Link: <a href={activePost.promoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-hover)', fontFamily: 'var(--mono)' }}>{activePost.promoUrl}</a></span>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleSharePost(activePost.id)}>
                        <Share2 size={14} /> Share Link
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <button className="post-action-btn" onClick={() => handleLikePost(activePost.id)}>
                      <ThumbsUp size={16} /> Like ({activePost.likes})
                    </button>
                    <button className="post-action-btn" onClick={() => handleSubmitReport('POST', activePost.id)}>
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
                    {comments.filter(c => c.postId === activePost.id).map(c => (
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
                  <button className="btn btn-primary" onClick={() => { setActiveTab('community'); setActivePost({ id: 'new' }); }}>
                    Create Promotion Post
                  </button>
                </div>

                {activePost?.id === 'new' ? (
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
                        <textarea className="form-input" rows="6" placeholder="Introduce your site and request specific QA/UX feedback..." value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} required></textarea>
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
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TABS 7: ADMIN & CS */}
        {activeTab === 'admin' && (
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Governance, Support & Analytics Dashboard</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
              <div>
                {currentUser.role === 'ADMIN' ? (
                  // Admin Backoffice controls
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card">
                      <h3 style={{ marginBottom: '1rem' }}>Report Feed Moderation</h3>
                      <div className="table-wrapper">
                        <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Target ID</th>
                              <th>Reason</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reports.map(rep => (
                              <tr key={rep.id}>
                                <td><span className="badge badge-pending">{rep.targetType}</span></td>
                                <td>{rep.targetId}</td>
                                <td>{rep.reason}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                      onClick={() => handleSuspendUser('f87a32d1-921c-4b9b-90f3-cb2071850123')}
                                    >
                                      Suspend Author
                                    </button>
                                    <button 
                                      className="btn btn-success" 
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                      onClick={() => setReports(reports.filter(r => r.id !== rep.id))}
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {reports.length === 0 && (
                              <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending abuse reports.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card">
                      <h3 style={{ marginBottom: '1rem' }}>Daily Platform Performance batch (7D Retention)</h3>
                      <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => showAlert('Platform Daily Aggregations updated for LocalDate.now().', 'success')}>
                        Trigger Batch Statistic Calculation
                      </button>

                      <div style={{ height: '220px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailyStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--accent)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }} />
                            <Legend />
                            <Line type="monotone" dataKey="retentionRate7d" name="7D Retention Rate (%)" stroke="var(--success)" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="totalTestsRun" name="Total Daily Tests Run" stroke="var(--accent)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Normal user CS view
                  <div className="card">
                    <h3 style={{ marginBottom: '1.25rem' }}>Submit 1:1 CS Inquiry</h3>
                    <form onSubmit={handleCreateInquiry}>
                      <div className="form-group">
                        <label className="form-label">Subject</label>
                        <input type="text" className="form-input" placeholder="Brief subject details..." value={newInquiryTitle} onChange={(e) => setNewInquiryTitle(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Inquiry Message</label>
                        <textarea className="form-input" rows="5" placeholder="Detail your billing error, test failure, or coupon issue..." value={newInquiryContent} onChange={(e) => setNewInquiryContent(e.target.value)} required></textarea>
                      </div>
                      <button type="submit" className="btn btn-primary">Submit CS Ticket</button>
                    </form>
                  </div>
                )}
              </div>

              <div>
                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>1:1 Inquiry Tickets & Answers</h3>
                  
                  {currentUser.role === 'ADMIN' ? (
                    // Admin inquiry response view
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {inquiries.map(inq => (
                        <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <span>Author: {inq.userId.substring(0, 8)}...</span>
                            <span>{inq.createdAt}</span>
                          </div>
                          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{inq.content}</p>
                          
                          {inq.status === 'PENDING' ? (
                            <div>
                              <textarea 
                                className="form-input" 
                                placeholder="Write support reply..." 
                                value={newAdminAnswer} 
                                onChange={(e) => setNewAdminAnswer(e.target.value)}
                                style={{ marginBottom: '0.5rem' }}
                              ></textarea>
                              <button className="btn btn-primary" onClick={() => handleAnswerInquiry(inq.id)}>
                                Answer Ticket
                              </button>
                            </div>
                          ) : (
                            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>Admin Reply:</div>
                              <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // User inquiry list view
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {inquiries.filter(i => i.userId === currentUser.id).map(inq => (
                        <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <span>Status: <span className={inq.status === 'ANSWERED' ? 'badge badge-success' : 'badge badge-pending'}>{inq.status}</span></span>
                            <span>{inq.createdAt}</span>
                          </div>
                          <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{inq.content}</p>
                          
                          {inq.answer && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: '0.25rem' }}>Answer:</div>
                              <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
