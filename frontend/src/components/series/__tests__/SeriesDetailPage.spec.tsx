import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => {
            const { whileHover, initial, animate, exit, ...rest } = props;
            return <div {...rest}>{children}</div>;
        },
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    ArrowLeft: (props: any) => <span data-testid="icon-arrow-left" {...props} />,
    Users: (props: any) => <span data-testid="icon-users" {...props} />,
    MapPin: (props: any) => <span data-testid="icon-map-pin" {...props} />,
    Package: (props: any) => <span data-testid="icon-package" {...props} />,
    Plus: (props: any) => <span data-testid="icon-plus" {...props} />,
    X: (props: any) => <span data-testid="icon-x" {...props} />,
    Image: (props: any) => <span data-testid="icon-image" {...props} />,
    Settings: (props: any) => <span data-testid="icon-settings" {...props} />,
    FileText: (props: any) => <span data-testid="icon-file-text" {...props} />,
    Download: (props: any) => <span data-testid="icon-download" {...props} />,
}));

// Mock API
const mockGetSeries = vi.fn();
const mockGetSeriesEpisodes = vi.fn();
const mockUpdateSeries = vi.fn();
const mockCreateProject = vi.fn();
const mockAddEpisodeToSeries = vi.fn();

vi.mock('@/lib/api', () => ({
    api: {
        getSeries: (...args: any[]) => mockGetSeries(...args),
        getSeriesEpisodes: (...args: any[]) => mockGetSeriesEpisodes(...args),
        updateSeries: (...args: any[]) => mockUpdateSeries(...args),
        createProject: (...args: any[]) => mockCreateProject(...args),
        addEpisodeToSeries: (...args: any[]) => mockAddEpisodeToSeries(...args),
    },
}));

import SeriesDetailPage from '../SeriesDetailPage';

// ── Test Data ──

const mockSeries = {
    id: 'series-1',
    title: '测试系列',
    description: '这是一个测试系列',
    characters: [
        { id: 'char-1', name: '角色A', description: '描述A' },
        { id: 'char-2', name: '角色B', description: '描述B' },
    ],
    scenes: [
        { id: 'scene-1', name: '场景A', description: '场景描述A' },
    ],
    props: [],
    episode_ids: ['ep-1', 'ep-2'],
    created_at: Date.now(),
    updated_at: Date.now(),
};

const mockEpisodes = [
    { id: 'ep-1', title: '第一集', episode_number: 1, frames: [{ id: 'f1' }] },
    { id: 'ep-2', title: '第二集', episode_number: 2, frames: [] },
];

// ── Helpers ──

function renderPage(seriesId = 'series-1') {
    return render(<SeriesDetailPage seriesId={seriesId} />);
}

// ── Tests ──

describe('SeriesDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSeries.mockResolvedValue(mockSeries);
        mockGetSeriesEpisodes.mockResolvedValue(mockEpisodes);
    });

    // ── Rendering ──

    describe('Rendering', () => {
        it('shows loading state initially', () => {
            // Make API hang so loading persists
            mockGetSeries.mockReturnValue(new Promise(() => {}));
            mockGetSeriesEpisodes.mockReturnValue(new Promise(() => {}));
            renderPage();
            expect(screen.getByText('加载中...')).toBeInTheDocument();
        });

        it('shows series title after loading', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
        });

        it('shows series description', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('这是一个测试系列')).toBeInTheDocument();
            });
        });
    });

    // ── Error state ──

    describe('Error state', () => {
        it('shows error view when API fails', async () => {
            mockGetSeries.mockRejectedValue(new Error('Network error'));
            mockGetSeriesEpisodes.mockRejectedValue(new Error('Network error'));
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('系列未找到')).toBeInTheDocument();
            });
        });

        it('shows link to go back to home on error', async () => {
            mockGetSeries.mockRejectedValue(new Error('fail'));
            mockGetSeriesEpisodes.mockRejectedValue(new Error('fail'));
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('返回首页')).toBeInTheDocument();
            });
        });
    });

    // ── Assets display / Tab switching ──

    describe('Assets display', () => {
        it('shows characters tab as active by default', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            // Characters tab should show the count
            expect(screen.getByText('角色')).toBeInTheDocument();
            // Character assets should be visible
            expect(screen.getByText('角色A')).toBeInTheDocument();
            expect(screen.getByText('角色B')).toBeInTheDocument();
        });

        it('switches to scenes tab when clicked', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('场景'));
            expect(screen.getByText('场景A')).toBeInTheDocument();
        });

        it('shows empty state when props tab has no assets', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('道具'));
            expect(screen.getByText('暂无道具资产')).toBeInTheDocument();
        });

        it('displays asset counts in tabs', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            // Characters: 2, Scenes: 1, Props: 0
            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('0')).toBeInTheDocument();
        });
    });

    // ── Episode list ──

    describe('Episode list', () => {
        it('shows episode list with titles', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('第一集')).toBeInTheDocument();
            });
            expect(screen.getByText('第二集')).toBeInTheDocument();
        });

        it('shows episode numbers', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('EP1')).toBeInTheDocument();
            });
            expect(screen.getByText('EP2')).toBeInTheDocument();
        });

        it('shows frame count for episodes', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('1 分镜')).toBeInTheDocument();
            });
            expect(screen.getByText('0 分镜')).toBeInTheDocument();
        });

        it('navigates on episode click', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('第一集')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('第一集'));
            expect(window.location.hash).toBe('#/series/series-1/episode/ep-1');
        });

        it('shows episodes count in header', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('集数 (2)')).toBeInTheDocument();
            });
        });
    });

    // ── Empty episode state ──

    describe('Empty episode state', () => {
        it('shows empty state when no episodes', async () => {
            mockGetSeriesEpisodes.mockResolvedValue([]);
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('暂无集数')).toBeInTheDocument();
            });
        });
    });

    // ── Edit title ──

    describe('Edit title', () => {
        it('enters edit mode on double click', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.doubleClick(screen.getByText('测试系列'));
            const input = screen.getByDisplayValue('测试系列');
            expect(input).toBeInTheDocument();
            expect(input.tagName).toBe('INPUT');
        });

        it('saves title on blur', async () => {
            mockUpdateSeries.mockResolvedValue({});
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.doubleClick(screen.getByText('测试系列'));
            const input = screen.getByDisplayValue('测试系列');
            fireEvent.change(input, { target: { value: '新标题' } });
            fireEvent.blur(input);
            await waitFor(() => {
                expect(mockUpdateSeries).toHaveBeenCalledWith('series-1', { title: '新标题' });
            });
        });

        it('saves title on Enter key', async () => {
            mockUpdateSeries.mockResolvedValue({});
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.doubleClick(screen.getByText('测试系列'));
            const input = screen.getByDisplayValue('测试系列');
            fireEvent.change(input, { target: { value: '回车标题' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            await waitFor(() => {
                expect(mockUpdateSeries).toHaveBeenCalledWith('series-1', { title: '回车标题' });
            });
        });

        it('cancels edit on Escape key', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.doubleClick(screen.getByText('测试系列'));
            const input = screen.getByDisplayValue('测试系列');
            fireEvent.change(input, { target: { value: '取消的标题' } });
            fireEvent.keyDown(input, { key: 'Escape' });
            // Should revert and exit edit mode
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            expect(mockUpdateSeries).not.toHaveBeenCalled();
        });

        it('reverts title if API fails', async () => {
            mockUpdateSeries.mockRejectedValue(new Error('API error'));
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
            fireEvent.doubleClick(screen.getByText('测试系列'));
            const input = screen.getByDisplayValue('测试系列');
            fireEvent.change(input, { target: { value: '失败标题' } });
            fireEvent.blur(input);
            await waitFor(() => {
                expect(screen.getByText('测试系列')).toBeInTheDocument();
            });
        });
    });

    // ── Add episode ──

    describe('Add episode', () => {
        it('shows add episode button', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('添加集数')).toBeInTheDocument();
            });
        });

        it('shows input form when add button is clicked', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('添加集数')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('添加集数'));
            expect(screen.getByPlaceholderText('集数标题...')).toBeInTheDocument();
            expect(screen.getByText('确定')).toBeInTheDocument();
            expect(screen.getByText('取消')).toBeInTheDocument();
        });

        it('creates new episode when confirmed', async () => {
            const newProject = { id: 'new-proj', title: '新集数' };
            mockCreateProject.mockResolvedValue(newProject);
            mockAddEpisodeToSeries.mockResolvedValue({});
            mockGetSeriesEpisodes.mockResolvedValueOnce(mockEpisodes).mockResolvedValueOnce([
                ...mockEpisodes,
                { id: 'new-proj', title: '新集数', episode_number: 3, frames: [] },
            ]);

            renderPage();
            await waitFor(() => {
                expect(screen.getByText('添加集数')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('添加集数'));

            const input = screen.getByPlaceholderText('集数标题...');
            fireEvent.change(input, { target: { value: '新集数' } });
            fireEvent.click(screen.getByText('确定'));

            await waitFor(() => {
                expect(mockCreateProject).toHaveBeenCalledWith('新集数', '', true);
            });
            await waitFor(() => {
                expect(mockAddEpisodeToSeries).toHaveBeenCalledWith('series-1', 'new-proj', 3);
            });
        });

        it('hides form when cancel is clicked', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('添加集数')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('添加集数'));
            expect(screen.getByPlaceholderText('集数标题...')).toBeInTheDocument();
            fireEvent.click(screen.getByText('取消'));
            expect(screen.queryByPlaceholderText('集数标题...')).not.toBeInTheDocument();
        });

        it('disables confirm button when title is empty', async () => {
            renderPage();
            await waitFor(() => {
                expect(screen.getByText('添加集数')).toBeInTheDocument();
            });
            fireEvent.click(screen.getByText('添加集数'));
            const confirmBtn = screen.getByText('确定');
            expect(confirmBtn).toBeDisabled();
        });
    });
});
