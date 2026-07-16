import { Button } from '../common';

export const COMMENTS_PER_PAGE = 20;

interface CommentPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function CommentPagination({
    currentPage,
    totalPages,
    onPageChange,
}: CommentPaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    const pageGroupSize = 10;

    const pageGroupStart =
        Math.floor((currentPage - 1) / pageGroupSize) *
        pageGroupSize +
        1;

    const pageGroupEnd = Math.min(
        pageGroupStart + pageGroupSize - 1,
        totalPages,
    );

    const pageNumbers = Array.from(
        {
            length: pageGroupEnd - pageGroupStart + 1,
        },
        (_, index) => pageGroupStart + index,
    );

    const movePage = (page: number) => {
        if (page < 1 || page > totalPages) {
            return;
        }

        onPageChange(page);

        window.requestAnimationFrame(() => {
            document
                .querySelector('.community-comments')
                ?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
        });
    };

    return (
        <nav
            className="community-pagination"
            aria-label="댓글 페이지"
        >
            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() =>
                    movePage(currentPage - 1)
                }
            >
                이전
            </Button>

            {pageNumbers.map((pageNumber) => (
                <Button
                    type="button"
                    key={pageNumber}
                    variant={
                        currentPage === pageNumber
                            ? 'primary'
                            : 'secondary'
                    }
                    size="sm"
                    aria-current={
                        currentPage === pageNumber
                            ? 'page'
                            : undefined
                    }
                    onClick={() => movePage(pageNumber)}
                >
                    {pageNumber}
                </Button>
            ))}

            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() =>
                    movePage(currentPage + 1)
                }
            >
                다음
            </Button>
        </nav>
    );
}
