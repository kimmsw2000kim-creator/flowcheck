import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import { login, signup } from "./api/authApi";
import { supabase } from "./utils/supabase";

// Pages
import DashboardPage from './pages/DashboardPage';
import DomainsPage from './pages/DomainsPage';
import QaPage from './pages/QaPage';
import LoadPage from './pages/LoadPage';
import BillingPage from './pages/BillingPage';
import CommunityPage from './pages/CommunityPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

interface Domain {
  id: number;
  domainUrl: string;
  verificationToken: string;
  verified: boolean;
  createdAt: string;
}

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

interface LedgerItem {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface ActiveOrder {
  id: string;
  amount: number;
  bank: string;
  accountNumber: string;
  customerName: string;
  dueDate: string;
}

interface Report {
  id: number;
  reporterId: string;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface Inquiry {
  id: number;
  userId: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  createdAt: string;
}

interface DailyStat {
  date: string;
  totalUsers: number;
  newUsers: number;
  totalVerifiedDomains: number;
  totalTestsRun: number;
  totalCreditsConsumed: number;
  retentionRate7d: number;
}

interface AlertMsg {
  message: string;
  type: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUser, setCurrentUser] = useState({
    id: 'f87a32d1-921c-4b9b-90f3-cb2071850123',
    email: 'corp-user@flowcheck.com',
    role: 'USER', // USER or ADMIN
    balance: 75000,
    status: 'ACTIVE',
    coupons: 3
  });

  const [domains, setDomains] = useState<Domain[]>([
    { id: 1, domainUrl: 'https://myshop.com', verificationToken: 'overload-verify-da39a3ee5e6b4b0d3255bfef95601890afd80709', verified: true, createdAt: '2026-06-25' },
    { id: 2, domainUrl: 'https://testapp.io', verificationToken: 'overload-verify-7c5a0c3b9b8b7d6e5a4c3b2a1a', verified: false, createdAt: '2026-06-29' }
  ]);
  const [newDomainUrl, setNewDomainUrl] = useState<string>('');
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);

  // Billing states
  const [billingAmount, setBillingAmount] = useState<string>('50000');
  const [billingBank, setBillingBank] = useState<string>('KB');
  const [billingName, setBillingName] = useState<string>('강남길');
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([
    { id: 1, amount: 50000, type: 'CHARGE', description: 'Toss Payments Virtual Account Charge', createdAt: '2026-06-29 14:20' },
    { id: 2, amount: -30000, type: 'COUPON_BUY', description: 'Buy prepaid test coupons: 3 units', createdAt: '2026-06-29 14:30' },
    { id: 3, amount: 20000, type: 'PROMOTION', description: 'WELCOME2026', createdAt: '2026-06-30 09:00' }
  ]);
  const [promoCode, setPromoCode] = useState<string>('');

  // QA states
  const [selectedQaDomain, setSelectedQaDomain] = useState<number>(1);
  const [qaStatus, setQaStatus] = useState<string>('idle'); // idle, running, success, failed
  const [qaSteps, setQaSteps] = useState<any[]>([]);
  const [qaReportMarkdown, setQaReportMarkdown] = useState<string>('');

  // Load testing states
  const [selectedLoadDomain, setSelectedLoadDomain] = useState<number>(1);
  const [vusers, setVusers] = useState<number>(100);
  const [duration, setDuration] = useState<number>(30);
  const [loadPrompt, setLoadPrompt] = useState<string>('Simulate multiple checkouts under extreme concurrency');
  const [loadStatus, setLoadStatus] = useState<string>('idle'); // idle, running, success
  const [loadMetrics, setLoadMetrics] = useState<any | null>(null);
  const [loadChartData, setLoadChartData] = useState<any[]>([]);

  // Community states
  const [posts, setPosts] = useState<Post[]>([
    { id: 1, title: 'AI E-Commerce Checkout Optimization feedback wanted!', content: 'We built a checkout service using Gemini recommendations. We would love some load testing feedback or UI improvements.', promoUrl: 'https://myshop.com', userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', email: 'corp-user@flowcheck.com', likes: 12, shares: 4, createdAt: '2026-06-29' }
  ]);
  const [activePost, setActivePost] = useState<Post | { id: string } | null>(null);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostPromoUrl, setNewPostPromoUrl] = useState<string>('');
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, postId: 1, userId: 'd290f1e2-b8b8-4d56-bc9b-3e5f6e872111', author: 'tester1@flowcheck.io', content: 'Crawl speed was perfect, but the checkout form did not validate input parameters correctly.', parentId: null, createdAt: '2026-06-29 18:00' }
  ]);
  const [newCommentContent, setNewCommentContent] = useState<string>('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);

  // Admin states
  const [reports, setReports] = useState<Report[]>([
    { id: 1, reporterId: 'd290f1e2-b8b8-4d56-bc9b-3e5f6e872111', targetType: 'POST', targetId: 1, reason: 'Spam promotions', status: 'PENDING', createdAt: '2026-06-30' }
  ]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([
    { id: 1, userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123', title: 'Payment Webhook Delay', content: 'I deposited 50,000 KRW to the virtual account, but it took 10 minutes to update.', status: 'PENDING', answer: null, createdAt: '2026-06-30' }
  ]);
  const [newInquiryTitle, setNewInquiryTitle] = useState<string>('');
  const [newInquiryContent, setNewInquiryContent] = useState<string>('');
  const [newAdminAnswer, setNewAdminAnswer] = useState<string>('');
  const [dailyStats] = useState<DailyStat[]>([
    { date: '2026-06-24', totalUsers: 142, newUsers: 12, totalVerifiedDomains: 23, totalTestsRun: 110, totalCreditsConsumed: 450000, retentionRate7d: 38.5 },
    { date: '2026-06-25', totalUsers: 154, newUsers: 12, totalVerifiedDomains: 25, totalTestsRun: 125, totalCreditsConsumed: 520000, retentionRate7d: 41.2 },
    { date: '2026-06-26', totalUsers: 168, newUsers: 14, totalVerifiedDomains: 28, totalTestsRun: 140, totalCreditsConsumed: 600000, retentionRate7d: 40.8 },
    { date: '2026-06-27', totalUsers: 180, newUsers: 12, totalVerifiedDomains: 31, totalTestsRun: 165, totalCreditsConsumed: 580000, retentionRate7d: 42.5 },
    { date: '2026-06-28', totalUsers: 195, newUsers: 15, totalVerifiedDomains: 33, totalTestsRun: 190, totalCreditsConsumed: 700000, retentionRate7d: 44.1 },
    { date: '2026-06-29', totalUsers: 210, newUsers: 15, totalVerifiedDomains: 36, totalTestsRun: 210, totalCreditsConsumed: 850000, retentionRate7d: 45.0 }
  ]);

  const [alertMsg, setAlertMsg] = useState<AlertMsg | null>(null);

  const showAlert = (message: string, type: string = 'success') => {
    setAlertMsg({ message, type });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = await login({
        email,
        password,
      });

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("email", data.email);

      setCurrentUser((prev) => ({
        ...prev,
        email: data.email,
      }));

      showAlert("로그인 성공");

      setActiveTab("dashboard");
    } catch (error) {
      showAlert("로그인 실패", "error");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (error) {
      showAlert("Google 로그인 실패", "error");
    }
  };

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [nickname, setNickname] = useState("");

  const isLoggedIn = !!localStorage.getItem("accessToken");

  const handleLoginClick = () => {
    setActiveTab("login");
  };

  const handleLogoutClick = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("email");

    setCurrentUser((prev) => ({
      ...prev,
      email: "guest@flowcheck.com",
      role: "USER",
    }));

    showAlert("로그아웃 되었습니다.");
    setActiveTab("dashboard");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = await signup({
        email: signupEmail,
        password: signupPassword,
        nickname: nickname,
      });

      showAlert(data.message || "회원가입 성공! 이메일 인증을 확인하세요.");

      // 입력창 초기화
      setSignupEmail("");
      setSignupPassword("");
      setNickname("");

      // 로그인 화면으로 이동
      setActiveTab("login");

    } catch (error: any) {
      console.error(error);

      showAlert(
        error.response?.data?.message || "회원가입 실패",
        "error"
      );
    }
  };

  const toggleRole = () => {
  const nextRole = currentUser.role === "USER" ? "ADMIN" : "USER";

  setCurrentUser((prev) => ({
    ...prev,
    role: nextRole,
  }));

  showAlert(`Switched simulation role to: ${nextRole}`, "info");
};

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainUrl) return;
    const newDom: Domain = {
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

  const handleVerifyDomain = (id: number) => {
    setVerificationLoading(true);
    setTimeout(() => {
      setDomains(domains.map(d => d.id === id ? { ...d, verified: true } : d));
      setVerificationLoading(false);
      showAlert('Domain verification completed successfully!');
    }, 1500);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const mockOrder: ActiveOrder = {
      id: 'ord-' + Math.floor(Math.random() * 1000000),
      amount: parseInt(billingAmount),
      bank: billingBank,
      accountNumber: '110-' + Math.floor(100000 + Math.random() * 900000) + '-12345',
      customerName: billingName,
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
    };
    setActiveOrder(mockOrder);
    showAlert('Virtual account order created. Ready for deposit.');
  };

  const handleSimulateWebhook = () => {
    if (!activeOrder) return;
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

  const handleBuyCoupons = (count: number) => {
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

  const handleRedeemPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.trim().toUpperCase() !== 'WELCOME2026') {
      showAlert('Invalid promo code.', 'error');
      return;
    }
    if (ledger.some(l => l.type === 'PROMOTION' && l.description === 'WELCOME2026')) {
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

  const handleRunQa = () => {
    if (currentUser.coupons <= 0 && currentUser.balance < 10000) {
      showAlert('Insufficient coupons or balance.', 'error');
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
          setQaReportMarkdown(`# QA Audit Report for ${targetUrl}\n## Summary\n- Steps: 5\n- Issues: 0\n\n## Gemini Feedback\nOptimized layout. Accessible buttons.`);
          showAlert('Autonomous AI QA Crawl Completed!', 'success');
        }
      }, delay += 1000);
    });
  };

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
    setTimeout(() => {
      const targetUrl = domains.find(d => d.id === selectedLoadDomain)?.domainUrl || 'https://myshop.com';
      setLoadStatus('success');
      setLoadMetrics({
        maxTps: vusers * 1.8,
        avgResponse: 120 + (vusers * 0.4),
        errorRate: vusers > 200 ? 4.8 : 0.0,
        bottleneckDiagnosis: `# Bottleneck Analysis for ${targetUrl}\n- Max TPS: ${vusers * 1.8} req/s\n- Suggest database queries scaling.`
      });

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

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;
    const duplicate = posts.some(p => p.userId === currentUser.id);
    const newPost: Post = {
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

  const handleLikePost = (postId: number) => {
    if (ledger.some(l => l.type === 'REWARD_LIKE' && l.description.includes(`Post: ${postId}`))) {
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

  const handleSharePost = (postId: number) => {
    if (ledger.some(l => l.type === 'REWARD_SHARE' && l.description.includes(`Post: ${postId}`))) {
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

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent || !activePost) return;
    const duplicateCommentReward = ledger.some(l => l.type === 'REWARD_COMMENT' && l.description.includes(`Post: ${activePost.id}`));
    const newComment: Comment = {
      id: comments.length + 1,
      postId: typeof activePost.id === 'string' ? 0 : activePost.id,
      userId: currentUser.id,
      author: currentUser.email,
      content: newCommentContent,
      parentId: replyParentId,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setComments([...comments, newComment]);
    setNewCommentContent('');
    setReplyParentId(null);

    if (!duplicateCommentReward) {
      setCurrentUser(prev => ({ ...prev, balance: prev.balance + 5000 }));
      setLedger([
        { id: ledger.length + 1, amount: 5000, type: 'REWARD_COMMENT', description: `First feedback comment reward for Post: ${activePost.id}`, createdAt: new Date().toISOString().substring(0, 16) },
        ...ledger
      ]);
      showAlert('Feedback comment posted! 5,000 credits rewarded!', 'success');
    } else {
      showAlert('Comment posted.');
    }
  };

  const handleSubmitReport = (type: string, id: number) => {
    const report: Report = {
      id: reports.length + 1,
      reporterId: currentUser.id,
      targetType: type,
      targetId: id,
      reason: 'Inappropriate content',
      status: 'PENDING',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setReports([...reports, report]);
    showAlert('Abuse report submitted.');
  };

  const handleCreateInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInquiryTitle || !newInquiryContent) return;
    const inquiry: Inquiry = {
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
    showAlert('Support inquiry submitted.');
  };

  const handleSuspendUser = (targetUserId: string) => {
    showAlert(`User ${targetUserId} suspended for 7 days.`, 'success');
  };

  const handleAnswerInquiry = (id: number) => {
    if (!newAdminAnswer) return;
    setInquiries(inquiries.map(inq => inq.id === id ? { ...inq, status: 'ANSWERED', answer: newAdminAnswer } : inq));
    setNewAdminAnswer('');
    showAlert('Inquiry reply posted.');
  };

  return (
    <div className="app-container">
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

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setActivePost={setActivePost}
        currentUser={currentUser}
        toggleRole={toggleRole}
        isLoggedIn={isLoggedIn}
        onLogin={handleLoginClick}
        onLogout={handleLogoutClick}
      />

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <DashboardPage
            currentUser={currentUser}
            domains={domains}
            setActiveTab={setActiveTab}
            setSelectedQaDomain={setSelectedQaDomain}
          />
        )}

        {activeTab === 'domains' && (
          <DomainsPage
            domains={domains}
            newDomainUrl={newDomainUrl}
            setNewDomainUrl={setNewDomainUrl}
            handleAddDomain={handleAddDomain}
            handleVerifyDomain={handleVerifyDomain}
            verificationLoading={verificationLoading}
          />
        )}

        {activeTab === 'qa' && (
          <QaPage
            domains={domains}
            selectedQaDomain={selectedQaDomain}
            setSelectedQaDomain={setSelectedQaDomain}
            qaStatus={qaStatus}
            qaSteps={qaSteps}
            qaReportMarkdown={qaReportMarkdown}
            handleRunQa={handleRunQa}
          />
        )}

        {activeTab === 'load' && (
          <LoadPage
            domains={domains}
            selectedLoadDomain={selectedLoadDomain}
            setSelectedLoadDomain={setSelectedLoadDomain}
            vusers={vusers}
            setVusers={setVusers}
            duration={duration}
            setDuration={setDuration}
            loadPrompt={loadPrompt}
            setLoadPrompt={setLoadPrompt}
            loadStatus={loadStatus}
            loadMetrics={loadMetrics}
            loadChartData={loadChartData}
            handleRunLoadTest={handleRunLoadTest}
          />
        )}

        {activeTab === 'billing' && (
          <BillingPage
            billingAmount={billingAmount}
            setBillingAmount={setBillingAmount}
            billingBank={billingBank}
            setBillingBank={setBillingBank}
            billingName={billingName}
            setBillingName={setBillingName}
            activeOrder={activeOrder}
            handleCreateOrder={handleCreateOrder}
            handleSimulateWebhook={handleSimulateWebhook}
            handleBuyCoupons={handleBuyCoupons}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            handleRedeemPromo={handleRedeemPromo}
            ledger={ledger}
          />
        )}

        {activeTab === 'community' && (
          <CommunityPage
            currentUser={currentUser}
            posts={posts}
            activePost={activePost}
            setActivePost={setActivePost}
            newPostTitle={newPostTitle}
            setNewPostTitle={setNewPostTitle}
            newPostContent={newPostContent}
            setNewPostContent={setNewPostContent}
            newPostPromoUrl={newPostPromoUrl}
            setNewPostPromoUrl={setNewPostPromoUrl}
            handleCreatePost={handleCreatePost}
            handleLikePost={handleLikePost}
            handleSharePost={handleSharePost}
            comments={comments}
            newCommentContent={newCommentContent}
            setNewCommentContent={setNewCommentContent}
            replyParentId={replyParentId}
            setReplyParentId={setReplyParentId}
            handleCreateComment={handleCreateComment}
            handleSubmitReport={handleSubmitReport}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPage
            currentUser={currentUser}
            reports={reports}
            setReports={setReports}
            inquiries={inquiries}
            setInquiries={setInquiries}
            newInquiryTitle={newInquiryTitle}
            setNewInquiryTitle={setNewInquiryTitle}
            newInquiryContent={newInquiryContent}
            setNewInquiryContent={setNewInquiryContent}
            newAdminAnswer={newAdminAnswer}
            setNewAdminAnswer={setNewAdminAnswer}
            dailyStats={dailyStats}
            handleSuspendUser={handleSuspendUser}
            handleAnswerInquiry={handleAnswerInquiry}
            handleCreateInquiry={handleCreateInquiry}
            showAlert={showAlert}
          />
        )}

        {activeTab === "login" && (
          <LoginPage
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            handleLogin={handleLogin}
            handleGoogleLogin={handleGoogleLogin}
          />
        )}

        {activeTab === "signup" && (
          <SignupPage
            email={signupEmail}
            setEmail={setSignupEmail}
            password={signupPassword}
            setPassword={setSignupPassword}
            nickname={nickname}
            setNickname={setNickname}
            handleSignup={handleSignup}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
