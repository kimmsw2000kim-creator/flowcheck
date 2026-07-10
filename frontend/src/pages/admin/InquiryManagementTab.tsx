import React, { useState } from 'react';

interface Inquiry {
    id: number;
    userId: string;
    title: string;
    content: string;
    status: 'PENDING' | 'ANSWERED';
    answer: string | null;
    createdAt: string;
}

export default function InquiryManagementTab() {
    const [inquiries, setInquiries] = useState<Inquiry[]>([
        {
            id: 1,
            userId: 'f87a32d1-921c-4b9b-90f3-cb2071850123',
            title: 'Payment Webhook Delay',
            content: '50,000원을 가상계좌로 입금했는데 반영까지 10분이 걸렸습니다.',
            status: 'PENDING',
            answer: null,
            createdAt: '2026-06-30'
        }
    ]);
    const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});

    const handleAnswerChange = (id: number, value: string) => {
        setAnswerDrafts(prev => ({ ...prev, [id]: value }));
    };

    const handleAnswerInquiry = (id: number) => {
        const answer = answerDrafts[id];
        if (!answer) return;
        setInquiries(prev => prev.map(inq =>
            inq.id === id ? { ...inq, status: 'ANSWERED', answer } : inq
        ));
        setAnswerDrafts(prev => ({ ...prev, [id]: '' }));
    };

    return (
        <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>1:1 고객 문의 내역 및 답변</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {inquiries.map(inq => (
                    <div key={inq.id} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <span>작성 유저: {inq.userId.substring(0, 8)}...</span>
                            <span>{inq.createdAt}</span>
                        </div>
                        <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{inq.title}</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{inq.content}</p>

                        {inq.status === 'PENDING' ? (
                            <div>
                                <textarea
                                    className="form-input"
                                    placeholder="답변 내용을 작성하세요..."
                                    value={answerDrafts[inq.id] ?? ''}
                                    onChange={(e) => handleAnswerChange(inq.id, e.target.value)}
                                    style={{ marginBottom: '0.5rem' }}
                                ></textarea>
                                <button className="btn btn-primary" onClick={() => handleAnswerInquiry(inq.id)}>
                                    답변 등록
                                </button>
                            </div>
                        ) : (
                            <div style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--success)', borderRadius: '0.25rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>관리자 답변:</div>
                                <p style={{ fontSize: '0.9rem' }}>{inq.answer}</p>
                            </div>
                        )}
                    </div>
                ))}
                {inquiries.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>접수된 고객 문의가 없습니다.</div>
                )}
            </div>
        </div>
    );
}
