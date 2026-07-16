import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Monitor } from 'lucide-react';
import { fetchMypageTestHistory } from '../../api/mypageApi';
import type { MypageTestHistoryItem } from '../../types/mypage';
import { Badge, Button, Card, EmptyState } from '../common';

interface CommunityTestPickerProps {
  onSelect: (test: MypageTestHistoryItem) => void;
  refreshKey: number;
}

// 테스트 이력을 한 페이지에 5개씩 표시합니다.
const TESTS_PER_PAGE = 5;

// 백엔드의 테스트 진행 단계를 사용자에게 표시할 이름으로 변환합니다.
const phaseLabels: Record<string, string> = {
  QUEUED: '대기',
  PREPARING_REQUEST: '요청 준비',
  CALLING_FASTAPI: 'AI 서버 호출',
  PROCESSING_RESULTS: '결과 처리',
  SAVING_REPORT: '저장 중',
  COMPLETED: '완료',
  FAILED: '실패',
};

const statusTone = (status: string) => status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : 'info';

export default function CommunityTestPicker({
  onSelect,
  refreshKey,
}: CommunityTestPickerProps) {
  const navigate = useNavigate();

  const [tests, setTests] =
    useState<MypageTestHistoryItem[]>([]);

  // 현재 페이지는 사용자에게 표시하는 방식으로 1부터 시작합니다.
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 전체 페이지 수를 계산합니다.
  const totalPages = Math.ceil(
    tests.length / TESTS_PER_PAGE
  );

  // 현재 페이지에서 보여줄 테스트 5개만 가져옵니다.
  const visibleTests = tests.slice(
    (currentPage - 1) * TESTS_PER_PAGE,
    currentPage * TESTS_PER_PAGE
  );

  useEffect(() => {
    let cancelled = false;

    // 공유 직후에도 최신 연결 게시글 정보를 다시 불러옵니다.
    setLoading(true);
    setError('');

    fetchMypageTestHistory()
      .then((data) => {
        if (!cancelled) {
          setTests(data);

          // 데이터를 다시 조회하면 첫 페이지부터 표시합니다.
          setCurrentPage(1);
        }
      }).catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : '테스트 이력을 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <EmptyState title="테스트 이력을 불러오는 중입니다." description="잠시만 기다려 주세요." aria-live="polite" />;
  if (error) return <EmptyState title={error} description="로그인 상태를 확인하고 다시 시도해 주세요." />;
  if (tests.length === 0) return <EmptyState title="공유할 테스트 이력이 없습니다." description="테스트를 완료한 뒤 결과를 공유할 수 있습니다." />;

  return (
    <div className="community-test-picker">
      {/* 전체 목록이 아니라 현재 페이지의 테스트만 표시합니다. */}
      {visibleTests.map((test) => {
        const completed = test.status === 'COMPLETED';
        const linkedPostId = test.linkedPostId ?? null;
        const shared = linkedPostId !== null;
        const isUIUX =
          test.testType === 'UI' ||
          test.testType === 'UIUX';

        // 진행률이 0~100 범위를 벗어나지 않게 처리합니다.
        const progress = Math.min(
          Math.max(test.progress ?? 0, 0),
          100
        );

        // 마이페이지 테스트 상세 주소입니다.
        const detailPath =
          `/mypage/tests/${test.testType}/${test.requestId}`;

        const phaseLabel = test.phase
          ? phaseLabels[test.phase] || test.phase
          : null;

        // 현재 테스트 카드를 화면에 반환합니다.
        return (
          <Card as="article" key={`${test.testType}-${test.requestId}`} variant="outlined" className="community-test-picker__item">
            <div className="community-test-picker__icon">{isUIUX ? <Monitor size={20} aria-hidden="true" /> : <Activity size={20} aria-hidden="true" />}</div>
            <div className="community-test-picker__content">
              <div className="community-test-picker__heading">
                <strong>{test.testName}</strong>
                <Badge tone={statusTone(test.status)}>
                  {shared
                    ? '공유 완료'
                    : completed
                      ? '완료'
                      : test.status}
                </Badge>
              </div>
              <p>{test.targetUrl}</p>
              <small>
                {new Date(test.createdAt).toLocaleString('ko-KR')}
              </small>
              {/* 현재 진행 단계와 진행률을 표시합니다. */}
              <small>
                {phaseLabel && `${phaseLabel} · `}
                진행률 {progress}%
              </small>
              <progress
                max="100"
                value={progress}
                aria-label={`${test.testName} 진행률`}
              >
                {progress}%
              </progress>

              {/* 테스트 실행 시 저장된 설명이 있으면 표시합니다. */}
              {test.description && (
                <p>{test.description}</p>
              )}
              <div className="community-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(detailPath)}
                >
                  상세 보기
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!completed && !shared}
              onClick={() => {
                // 이미 공유했다면 중복 요청 대신 기존 게시글로 이동합니다.
                if (shared) {
                  navigate(`/community/${linkedPostId}`);
                  return;
                }

                onSelect(test);
              }}
            >
              {shared ? '공유한 글 보기' : '결과 공유'}
            </Button>
          </Card>
        );
      })}
      {/* 테스트가 6개 이상일 때 페이지 버튼을 표시합니다. */}
      {totalPages > 1 && (
        <nav
          className="community-pagination"
          aria-label="공유할 테스트 이력 페이지"
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentPage === 1}
            onClick={() =>
              setCurrentPage((page) =>
                Math.max(1, page - 1)
              )
            }
          >
            이전
          </Button>

          {Array.from(
            { length: totalPages },
            (_, index) => index + 1
          ).map((page) => (
            <Button
              key={page}
              type="button"
              size="sm"
              variant={
                currentPage === page
                  ? 'primary'
                  : 'secondary'
              }
              aria-current={
                currentPage === page
                  ? 'page'
                  : undefined
              }
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() =>
              setCurrentPage((page) =>
                Math.min(totalPages, page + 1)
              )
            }
          >
            다음
          </Button>
        </nav>
      )}
    </div>
  );
}
