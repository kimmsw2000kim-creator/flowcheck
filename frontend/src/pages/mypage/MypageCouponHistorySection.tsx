import { useEffect, useState } from 'react';
import { fetchMypageCouponHistory } from '../../api/mypageApi';
import type { MypageCouponHistoryItem } from '../../types/mypage';
import { Badge, EmptyState, PageHeader, Table, TableContainer } from '../../components/common';
import { supabase } from '../../lib/supabaseClient';
import styles from '../../styles/mypage.module.css';
import { getKoreanErrorMessage } from '../../utils/errorMessage';

const couponTypeLabels: Record<string, string> = { LOAD_TEST: '부하 테스트', UIUX_TEST: 'UI/UX 테스트', UNKNOWN: '알 수 없음' };
const formatDate = (value: string) => new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

function MypageCouponHistorySection() {
  const [histories, setHistories] = useState<MypageCouponHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) throw new Error('로그인이 필요합니다.');
        setHistories(await fetchMypageCouponHistory());
      } catch (error) {
        setErrorMessage(getKoreanErrorMessage(error, '쿠폰 사용 내역을 불러오지 못했습니다.'));
      } finally { setLoading(false); }
    };
    fetchHistory();
  }, []);

  return (
    <section className={styles['mypage-section']}>
      <PageHeader headingLevel={1} eyebrow="COUPONS" title="쿠폰 사용 내역" description="테스트 실행에 사용한 쿠폰 내역을 확인할 수 있습니다." />
      {loading && <EmptyState title="쿠폰 사용 내역을 불러오는 중입니다." description="잠시만 기다려 주세요." />}
      {!loading && errorMessage && <EmptyState title={errorMessage} description="로그인 상태를 확인한 뒤 다시 시도해 주세요." />}
      {!loading && !errorMessage && histories.length === 0 && <EmptyState title="쿠폰 사용 내역이 없습니다." description="쿠폰으로 테스트를 실행하면 이곳에 기록됩니다." />}
      {!loading && !errorMessage && histories.length > 0 && (
        <TableContainer><Table>
          <thead><tr><th>쿠폰</th><th>설명</th><th>사용 일시</th></tr></thead>
          <tbody>{histories.map((item) => <tr key={item.logId}>
            <td><Badge tone="info">{couponTypeLabels[item.couponType] || item.couponType}</Badge></td>
            <td>{item.description || '설명 없음'}</td><td>{formatDate(item.usedAt)}</td>
          </tr>)}</tbody>
        </Table></TableContainer>
      )}
    </section>
  );
}

export default MypageCouponHistorySection;
