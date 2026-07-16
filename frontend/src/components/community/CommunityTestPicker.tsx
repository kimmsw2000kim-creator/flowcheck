import { useEffect, useState } from 'react';
import { Activity, Monitor } from 'lucide-react';
import { fetchMypageTestHistory } from '../../api/mypageApi';
import type { MypageTestHistoryItem } from '../../types/mypage';
import { Badge, Button, Card, EmptyState } from '../common';

interface CommunityTestPickerProps {
  onSelect: (test: MypageTestHistoryItem) => void;
}

const statusTone = (status: string) => status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : 'info';

export default function CommunityTestPicker({ onSelect }: CommunityTestPickerProps) {
  const [tests, setTests] = useState<MypageTestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchMypageTestHistory()
      .then((data) => { if (!cancelled) setTests(data); })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : '테스트 이력을 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <EmptyState title="테스트 이력을 불러오는 중입니다." description="잠시만 기다려 주세요." aria-live="polite" />;
  if (error) return <EmptyState title={error} description="로그인 상태를 확인하고 다시 시도해 주세요." />;
  if (tests.length === 0) return <EmptyState title="공유할 테스트 이력이 없습니다." description="테스트를 완료한 뒤 결과를 공유할 수 있습니다." />;

  return (
    <div className="community-test-picker">
      {tests.map((test) => {
        const completed = test.status === 'COMPLETED';
        const isUIUX = test.testType === 'UI' || test.testType === 'UIUX';
        return (
          <Card as="article" key={`${test.testType}-${test.requestId}`} variant="outlined" className="community-test-picker__item">
            <div className="community-test-picker__icon">{isUIUX ? <Monitor size={20} aria-hidden="true" /> : <Activity size={20} aria-hidden="true" />}</div>
            <div className="community-test-picker__content">
              <div className="community-test-picker__heading"><strong>{test.testName}</strong><Badge tone={statusTone(test.status)}>{completed ? '완료' : test.status}</Badge></div>
              <p>{test.targetUrl}</p>
              <small>{new Date(test.createdAt).toLocaleString('ko-KR')}</small>
            </div>
            <Button variant="secondary" size="sm" disabled={!completed} onClick={() => onSelect(test)}>결과 공유</Button>
          </Card>
        );
      })}
    </div>
  );
}
