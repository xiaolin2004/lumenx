"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowLeft, Users, MapPin, Package, Plus, X, Image as ImageIcon, Settings, FileText, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { Series, Character, Scene, Prop, Project } from "@/store/projectStore";

const SeriesModelSettingsModal = dynamic(() => import("./SeriesModelSettingsModal"), { ssr: false });
const SeriesPromptConfigModal = dynamic(() => import("./SeriesPromptConfigModal"), { ssr: false });
const ImportAssetsDialog = dynamic(() => import("./ImportAssetsDialog"), { ssr: false });

interface SeriesDetailPageProps {
  seriesId: string;
}

type AssetTab = "characters" | "scenes" | "props";

export default function SeriesDetailPage({ seriesId }: SeriesDetailPageProps) {
  const [series, setSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AssetTab>("characters");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [showAddEpisode, setShowAddEpisode] = useState(false);
  const [newEpisodeTitle, setNewEpisodeTitle] = useState("");
  const [isCreatingEpisode, setIsCreatingEpisode] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showPromptConfig, setShowPromptConfig] = useState(false);
  const [showImportAssets, setShowImportAssets] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [seriesData, episodesData] = await Promise.all([
          api.getSeries(seriesId),
          api.getSeriesEpisodes(seriesId),
        ]);
        setSeries(seriesData);
        setEpisodes(episodesData);
        setEditTitle(seriesData.title);
      } catch (error) {
        console.error("Failed to fetch series data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [seriesId]);

  const handleBackToHome = () => {
    window.location.hash = "";
  };

  const handleTitleSave = async () => {
    if (!editTitle.trim() || !series) return;
    try {
      await api.updateSeries(seriesId, { title: editTitle.trim() });
      setSeries({ ...series, title: editTitle.trim() });
    } catch (error) {
      console.error("Failed to update series title:", error);
      setEditTitle(series.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") {
      setEditTitle(series?.title || "");
      setIsEditingTitle(false);
    }
  };

  const handleAddEpisode = async () => {
    if (!newEpisodeTitle.trim()) return;
    setIsCreatingEpisode(true);
    try {
      // Create a new project first, then add it to the series
      const project = await api.createProject(newEpisodeTitle.trim(), "", true);
      const nextEpNum = episodes.length + 1;
      await api.addEpisodeToSeries(seriesId, project.id, nextEpNum);

      // Refresh episodes list
      const updatedEpisodes = await api.getSeriesEpisodes(seriesId);
      setEpisodes(updatedEpisodes);
      setNewEpisodeTitle("");
      setShowAddEpisode(false);
    } catch (error) {
      console.error("Failed to add episode:", error);
    } finally {
      setIsCreatingEpisode(false);
    }
  };

  const handleOpenEpisode = (episodeId: string) => {
    window.location.hash = `#/series/${seriesId}/episode/${episodeId}`;
  };

  const refreshSeriesData = async () => {
    try {
      const [seriesData, episodesData] = await Promise.all([
        api.getSeries(seriesId),
        api.getSeriesEpisodes(seriesId),
      ]);
      setSeries(seriesData);
      setEpisodes(episodesData);
    } catch (error) {
      console.error("Failed to refresh series data:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-gray-400 mb-4">系列未找到</p>
          <a href="#/" className="text-primary hover:underline">返回首页</a>
        </div>
      </div>
    );
  }

  const tabs: { id: AssetTab; label: string; icon: typeof Users; count: number }[] = [
    { id: "characters", label: "角色", icon: Users, count: series.characters?.length || 0 },
    { id: "scenes", label: "场景", icon: MapPin, count: series.scenes?.length || 0 },
    { id: "props", label: "道具", icon: Package, count: series.props?.length || 0 },
  ];

  const currentAssets =
    activeTab === "characters"
      ? series.characters || []
      : activeTab === "scenes"
      ? series.scenes || []
      : series.props || [];

  return (
    <main className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-700/50 bg-gray-900/60 backdrop-blur-sm">
        <button
          onClick={handleBackToHome}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={18} />
          返回首页
        </button>

        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="text-2xl font-display font-bold text-white bg-transparent border-b-2 border-primary outline-none w-full max-w-lg"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-display font-bold text-white cursor-pointer hover:text-primary transition-colors truncate"
              onDoubleClick={() => setIsEditingTitle(true)}
              title="双击编辑标题"
            >
              {series.title}
            </h1>
          )}
          {series.description && (
            <p className="text-sm text-gray-400 mt-1 truncate">{series.description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowImportAssets(true)}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="导入资产"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => setShowPromptConfig(true)}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="提示词配置"
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => setShowModelSettings(true)}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="生成设置"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Main content: left panel (assets) + right panel (episodes) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - shared assets (60%) */}
        <div className="w-[60%] border-r border-gray-700/50 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700/50 bg-gray-900/30">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-primary text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Asset cards */}
          <div className="flex-1 overflow-y-auto p-4">
            {currentAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <ImageIcon size={48} className="mb-3 text-gray-600" />
                <p className="text-sm">暂无{tabs.find((t) => t.id === activeTab)?.label}资产</p>
                <p className="text-xs text-gray-600 mt-1">资产将在集数中生成后共享到这里</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {currentAssets.map((asset: Character | Scene | Prop) => (
                  <AssetCard key={asset.id} asset={asset} type={activeTab} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - episodes (40%) */}
        <div className="w-[40%] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gray-900/30">
            <h2 className="text-base font-display font-bold text-white">
              集数 ({episodes.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {episodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <p className="text-sm">暂无集数</p>
                <p className="text-xs text-gray-600 mt-1">点击下方按钮添加第一集</p>
              </div>
            ) : (
              [...episodes]
                .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0))
                .map((ep) => (
                  <motion.div
                    key={ep.id}
                    whileHover={{ scale: 1.01 }}
                    className="glass-panel p-4 rounded-xl cursor-pointer group"
                    onClick={() => handleOpenEpisode(ep.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs bg-primary/20 text-primary px-2.5 py-1 rounded-lg font-mono font-bold">
                          EP{ep.episode_number || "?"}
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                            {ep.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ep.frames?.length || 0} 分镜
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        打开 &rarr;
                      </span>
                    </div>
                  </motion.div>
                ))
            )}
          </div>

          {/* Add episode area */}
          <div className="border-t border-gray-700/50 p-4">
            {showAddEpisode ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newEpisodeTitle}
                  onChange={(e) => setNewEpisodeTitle(e.target.value)}
                  placeholder="集数标题..."
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddEpisode();
                    if (e.key === "Escape") setShowAddEpisode(false);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddEpisode}
                    disabled={!newEpisodeTitle.trim() || isCreatingEpisode}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isCreatingEpisode ? "创建中..." : "确定"}
                  </button>
                  <button
                    onClick={() => { setShowAddEpisode(false); setNewEpisodeTitle(""); }}
                    className="px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddEpisode(true)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm border border-dashed border-gray-600 hover:border-gray-400"
              >
                <Plus size={16} />
                添加集数
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SeriesModelSettingsModal
        isOpen={showModelSettings}
        onClose={() => setShowModelSettings(false)}
        seriesId={seriesId}
        onSaved={refreshSeriesData}
      />
      <SeriesPromptConfigModal
        isOpen={showPromptConfig}
        onClose={() => setShowPromptConfig(false)}
        seriesId={seriesId}
        onSaved={refreshSeriesData}
      />
      <ImportAssetsDialog
        isOpen={showImportAssets}
        onClose={() => setShowImportAssets(false)}
        seriesId={seriesId}
        onImported={refreshSeriesData}
      />
    </main>
  );
}

// ── Asset Card (simple display) ──
function AssetCard({ asset, type }: { asset: Character | Scene | Prop; type: AssetTab }) {
  // Get the thumbnail URL based on asset type
  const getImageUrl = (): string | undefined => {
    if (type === "characters") {
      const char = asset as Character;
      // Try to get selected variant image or fallback
      if (char.full_body_asset?.variants?.length) {
        const selected = char.full_body_asset.variants.find(
          (v) => v.id === char.full_body_asset?.selected_id
        );
        return selected?.url || char.full_body_asset.variants[0]?.url;
      }
      return char.image_url || char.full_body_image_url;
    }
    if (type === "scenes") {
      const scene = asset as Scene;
      if (scene.image_asset?.variants?.length) {
        const selected = scene.image_asset.variants.find(
          (v) => v.id === scene.image_asset?.selected_id
        );
        return selected?.url || scene.image_asset.variants[0]?.url;
      }
      return scene.image_url;
    }
    // props
    const prop = asset as Prop;
    if (prop.image_asset?.variants?.length) {
      const selected = prop.image_asset.variants.find(
        (v) => v.id === prop.image_asset?.selected_id
      );
      return selected?.url || prop.image_asset.variants[0]?.url;
    }
    return prop.image_url;
  };

  const imageUrl = getImageUrl();

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-800/50 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={32} className="text-gray-600" />
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-medium text-white truncate">{asset.name}</h4>
        {asset.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{asset.description}</p>
        )}
      </div>
    </div>
  );
}
