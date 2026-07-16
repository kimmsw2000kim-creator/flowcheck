import { useEffect, useState } from 'react';
import { fetchMypagePointHistory } from '../../api/mypageApi';
import type { MypagePointHistoryItem } from '../../types/mypage';
import { Badge, EmptyState, PageHeader, Table, TableContainer } from '../../components/common';
import { supabase } from '../../lib/supabaseClient';
import styles from '../../styles/mypage.module.css';

const typeLabels: Record<string, string> = { CHARGE: '크레딧 충전', TEST_CONSUME: '테스트 차감', COUPON_BUY: '쿠폰 구매' };
const formatDate = (value: string) => new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

function MypagePointHistorySection() {
  const [histories, setHistories] = useState<MypagePointHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) throw new Error('로그인이 필요합니다.');
        setHistories(await fetchMypagePointHistory());
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '포인트 내역을 불러오지 못했습니다.');
      } finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  return (
    <section className={styles['mypage-section']}>
      <PageHeader headingLevel={1} eyebrow="CREDITS" title="포인트 내역" description="충전, 사용, 보상 지급 내역을 확인할 수 있습니다." />
      {loading && <EmptyState title="포인트 내역을 불러오는 중입니다." description="잠시만 기다려 주세요." />}
      {!loading && errorMessage && <EmptyState title={errorMessage} description="로그인 상태를 확인한 뒤 다시 시도해 주세요." />}
      {!loading && !errorMessage && histories.length === 0 && <EmptyState title="포인트 내역이 없습니다." description="포인트 충전, 테스트 사용, 커뮤니티 보상 내역이 이곳에 표시됩니다." />}
      {!loading && !errorMessage && histories.length > 0 && (
        <TableContainer><Table>
          <thead><tr><th>구분</th><th>설명</th><th>일시</th><th>변동</th></tr></thead>
          <tbody>{histories.map((item) => {
            const positive = item.amount >= 0;
            return <tr key={item.ledgerId}>
              <td><Badge tone={positive ? 'success' : 'danger'}>{typeLabels[item.transactionType] || '기타'}</Badge></td>
              <td>{item.description}</td><td>{formatDate(item.createdAt)}</td>
              <td className={positive ? styles['amount-positive'] : styles['amount-negative']}>{positive ? '+' : ''}{item.amount.toLocaleString()}P</td>
            </tr>;
          })}</tbody>
        </Table></TableContainer>
      )}
    </section>
  );
}

export default MypagePointHistorySection;
