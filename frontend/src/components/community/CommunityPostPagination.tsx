import { Button } from '../common';

const PAGE_GROUP_SIZE = 5;

interface CommunityPostPaginationProps {
    ariaLabel: string;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function CommunityPostPagination({
    ariaLabel,
    currentPage,
    totalPages,
    onPageChange,
}: CommunityPostPaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    /*
     * Spring 페이지 번호는 0부터 시작하므로 내부 값은 그대로 유지하고,
     * 사용자에게 보여주는 번호만 1부터 시작하도록 변환합니다.
     */
    const pageGroupStart =
        Math.floor(currentPage / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE;
    const pageGroupEnd = Math.min(
        pageGroupStart + PAGE_GROUP_SIZE,
        totalPages,
    );
    const pageNumbers = Array.from(
        { length: pageGroupEnd - pageGroupStart },
        (_, index) => pageGroupStart + index,
    );

    const movePage = (page: number) => {
        if (page < 0 || page >= totalPages || page === currentPage) {
            return;
        }

        onPageChange(page);
    };

    return (
        <nav
            aria-label={ariaLabel}
            className="community-pagination community-post-pagination"
        >
            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => movePage(currentPage - 1)}
            >
                이전
            </Button>

            {pageNumbers.map((page) => (
                <Button
                    key={page}
                    type="button"
                    variant={currentPage === page ? 'primary' : 'secondary'}
                    size="sm"
                    aria-label={`${page + 1}페이지`}
                    aria-current={currentPage === page ? 'page' : undefined}
                    onClick={() => movePage(page)}
                >
                    {page + 1}
                </Button>
            ))}

            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages - 1}
                onClick={() => movePage(currentPage + 1)}
            >
                다음
            </Button>
        </nav>
    );
}
