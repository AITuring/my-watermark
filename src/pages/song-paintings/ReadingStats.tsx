import { useMemo, useState } from "react";
import type { Artwork } from "./model";
import { buildReadingStats, sortByTotal, type StatGroup } from "./statistics";
import "./statistics.css";

const numberFormat = new Intl.NumberFormat("zh-CN");
const percentFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });
const dimensions = [
    { key: "artists", label: "作者" },
    { key: "collections", label: "馆藏" },
    { key: "periods", label: "年代" },
    { key: "books", label: "册号" },
] as const;
type Dimension = typeof dimensions[number]["key"];

function GroupBar({ group, variant = "green" }: { group: StatGroup; variant?: "green" | "rust" }) {
    return (
        <li className="song-stat-row" data-tone={variant}>
            <div className="song-stat-row-label">
                <span>{group.label}</span>
                <span className="song-stat-row-count"><strong>{numberFormat.format(group.read)}</strong> / {numberFormat.format(group.total)}<span>{percentFormat.format(group.percent)}%</span></span>
            </div>
            <div className="song-stat-track" aria-hidden="true"><span style={{ width: `${group.percent}%` }} /></div>
        </li>
    );
}

export default function ReadingStats({ artworks }: { artworks: readonly Artwork[] }) {
    const statistics = useMemo(() => buildReadingStats(artworks), [artworks]);
    const [dimension, setDimension] = useState<Dimension>("artists");
    const [expanded, setExpanded] = useState(false);
    const groups = useMemo(() => sortByTotal(statistics[dimension]), [statistics, dimension]);
    const shown = expanded ? groups : groups.slice(0, 8);
    const dimensionLabel = dimensions.find((item) => item.key === dimension)!.label;

    return (
        <section className="song-statistics" aria-labelledby="song-statistics-heading">
            <header className="song-stats-heading">
                <div><p>翻阅足迹</p><h2 id="song-statistics-heading">阅读概览</h2></div>
                <p>以完整目录的 {numberFormat.format(statistics.total)} 条作品为基准，不受目录筛选影响。</p>
            </header>

            <div className="song-stats-overview">
                <div className="song-stats-completion">
                    <svg className="song-stats-ring" viewBox="0 0 160 160" role="img" aria-label={`阅读进度 ${percentFormat.format(statistics.percent)}%，已看过 ${statistics.read} 条，共 ${statistics.total} 条`}>
                        <circle className="song-stats-ring-track" cx="80" cy="80" r="66" fill="none" strokeWidth="8" />
                        <circle className="song-stats-ring-value" cx="80" cy="80" r="66" fill="none" strokeWidth="8" pathLength="100" strokeDasharray={`${statistics.percent} 100`} transform="rotate(-90 80 80)" />
                        <text className="song-stats-ring-number" x="80" y="79" textAnchor="middle">{percentFormat.format(statistics.percent)}<tspan>%</tspan></text>
                        <text className="song-stats-ring-caption" x="80" y="102" textAnchor="middle">已看过</text>
                    </svg>
                    <div className="song-stats-totals">
                        <h3>总阅读进度</h3>
                        <p><strong>{numberFormat.format(statistics.read)}</strong><span> / {numberFormat.format(statistics.total)} 条</span></p>
                        <p>还有 {numberFormat.format(statistics.unread)} 条没看过</p>
                    </div>
                </div>
                <div className="song-stats-editions">
                    <h3>国内与海外</h3>
                    <p className="song-stats-explanation">已看过 / 作品总数</p>
                    <ul>{statistics.editions.map((group) => <GroupBar key={group.id} group={group} variant={group.id === "overseas" ? "rust" : "green"} />)}</ul>
                </div>
            </div>

            <div className="song-stats-breakdown">
                <section className="song-stats-volumes" aria-labelledby="song-stats-volumes-heading">
                    <div className="song-stats-section-heading"><h3 id="song-stats-volumes-heading">逐卷进度</h3><span>已看过 / 卷内作品数</span></div>
                    <ul>{statistics.volumes.map((group) => <GroupBar key={group.id} group={group} />)}</ul>
                </section>

                <section className="song-stats-dimensions" aria-labelledby="song-stats-dimensions-heading">
                    <div className="song-stats-section-heading"><h3 id="song-stats-dimensions-heading">分类进度</h3><span>已看过 / 分类作品数</span></div>
                    <div className="song-stats-dimension-switch" role="group" aria-label="统计维度">
                        {dimensions.map((item) => <button key={item.key} type="button" aria-pressed={dimension === item.key} onClick={() => { setDimension(item.key); setExpanded(false); }}>{item.label}</button>)}
                    </div>
                    <p className="song-stats-ranking-note">按作品总数从多到少排列{groups.length > 8 && !expanded ? `，显示前 8 项（共 ${groups.length} 项）` : `，共 ${groups.length} 项`}。</p>
                    {shown.length > 0 ? <ul aria-label={`${dimensionLabel}阅读进度`}>{shown.map((group) => <GroupBar key={group.id} group={group} />)}</ul> : <p className="song-stats-empty">暂无可统计的{dimensionLabel}数据。</p>}
                    {groups.length > 8 && <button type="button" className="song-stats-expand" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "收起，显示前 8 项" : `展开全部 ${groups.length} 项`}</button>}
                </section>
            </div>
        </section>
    );
}
