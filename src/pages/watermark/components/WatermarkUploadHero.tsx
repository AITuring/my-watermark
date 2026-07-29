import React from "react";
import { Icon } from "@iconify/react";
import ChineseWaveBackground from "@/components/ChineseWaveBackground";
import ImageUploader from "@/components/ImageUploader";

interface WatermarkUploadHeroProps {
    mobile?: boolean;
    dropzoneRef?: React.Ref<HTMLDivElement>;
    onUpload: (files: File[]) => void | Promise<void>;
}

const MobileIllustration = () => (
    <div className="relative mb-3 md:mb-4 w-16 h-12 md:w-18 md:h-14">
        <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg shadow-lg transform transition-all duration-700 ease-out group-hover:translate-x-3 group-hover:translate-y-2 group-hover:rotate-6 group-hover:scale-95">
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-200 to-green-200" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-300 to-transparent" />
                <div className="absolute bottom-1/3 left-1/4 w-3 h-2 bg-green-400 rounded-full opacity-60" />
                <div className="absolute bottom-1/4 right-1/3 w-2 h-1.5 bg-green-500 rounded-full opacity-40" />
            </div>
        </div>

        <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-500 rounded-lg shadow-xl transform transition-all duration-600 ease-out group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-3 group-hover:scale-105 z-10">
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-200 to-yellow-200" />
                <div className="absolute bottom-0 left-0 w-2 h-3 bg-gray-400 opacity-70" />
                <div className="absolute bottom-0 left-2 w-1.5 h-4 bg-gray-500 opacity-60" />
                <div className="absolute bottom-0 right-2 w-2 h-2.5 bg-gray-400 opacity-80" />
                <div className="absolute top-1/4 right-1/4 w-4 h-1 bg-yellow-300 rounded-full opacity-60" />
            </div>
        </div>

        <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-white to-slate-100 dark:from-slate-500 dark:to-slate-400 rounded-lg shadow-2xl transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-translate-y-2 group-hover:-rotate-8 group-hover:scale-110 z-20">
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-purple-100" />
                <div className="absolute bottom-0 left-0 right-0 h-2/3">
                    <svg
                        className="w-full h-full text-purple-300/60"
                        fill="currentColor"
                        viewBox="0 0 100 60"
                    >
                        <path d="M0 60 L20 30 L40 45 L60 20 L80 35 L100 15 L100 60 Z" />
                    </svg>
                </div>
                <div className="absolute top-1/4 right-1/3 w-3 h-1 bg-yellow-200 rounded-full opacity-80" />
            </div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-300 z-30">
            <div className="bg-white/90 dark:bg-slate-800/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                <Icon
                    icon="mdi:plus"
                    className="h-3 w-3 md:h-4 md:w-4 text-slate-600 dark:text-slate-300"
                />
            </div>
        </div>

        <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transform translate-y-6 rotate-12 group-hover:translate-y-0 group-hover:rotate-0 transition-all duration-800 delay-400 z-30">
            <div className="w-4 h-3 md:w-5 md:h-4 bg-gradient-to-br from-pink-200 to-pink-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-b from-pink-100 to-rose-200 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-pink-200/30" />
                </div>
            </div>
        </div>
        <div className="absolute -top-2 -right-6 opacity-0 group-hover:opacity-100 transform translate-y-8 rotate-45 group-hover:translate-y-0 group-hover:rotate-12 transition-all duration-900 delay-500 z-30">
            <div className="w-3 h-2.5 md:w-4 md:h-3 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-b from-emerald-100 to-teal-200 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-emerald-200/30" />
                </div>
            </div>
        </div>
    </div>
);

const DesktopIllustration = () => (
    <div className="relative mb-3 md:mb-4 w-16 h-12 md:w-18 md:h-14">
        <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg shadow-lg transform transition-all duration-700 ease-out group-hover:translate-x-3 group-hover:translate-y-2 group-hover:rotate-6 group-hover:scale-95">
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-200 to-green-200" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-green-300 to-transparent" />
                <div className="absolute bottom-1/3 left-1/4 w-3 h-2 bg-green-400 rounded-full opacity-60" />
                <div className="absolute bottom-1/4 right-1/3 w-2 h-1.5 bg-green-500 rounded-full opacity-40" />
            </div>
        </div>

        <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-500 rounded-lg shadow-xl transform transition-all duration-600 ease-out group-hover:-translate-x-2 group-hover:translate-y-1 group-hover:-rotate-3 group-hover:scale-105 z-10">
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-200 to-yellow-200" />
                <div className="absolute bottom-0 left-0 w-2 h-3 bg-gray-400 opacity-70" />
                <div className="absolute bottom-0 left-2 w-1.5 h-4 bg-gray-500 opacity-60" />
                <div className="absolute bottom-0 right-2 w-2 h-2.5 bg-gray-400 opacity-80" />
                <div className="absolute top-1/4 right-1/4 w-4 h-1 bg-yellow-300 rounded-full opacity-60" />
            </div>
        </div>

        <div className="absolute inset-0 w-12 h-10 md:w-14 md:h-12 bg-gradient-to-br from-white to-slate-100 dark:from-slate-500 dark:to-slate-400 rounded-lg shadow-2xl transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-translate-y-2 group-hover:-rotate-8 group-hover:scale-110 z-20">
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-blue-100 to-emerald-100" />
                <div className="absolute bottom-0 left-0 right-0 h-3/4">
                    <svg
                        className="w-full h-full text-slate-300/40"
                        fill="currentColor"
                        viewBox="0 0 100 60"
                    >
                        <path d="M0 60 L15 45 L25 50 L35 35 L50 40 L65 25 L80 30 L100 20 L100 60 Z" />
                    </svg>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-2/3">
                    <svg
                        className="w-full h-full text-emerald-400/50"
                        fill="currentColor"
                        viewBox="0 0 100 60"
                    >
                        <path d="M0 60 L20 40 L35 45 L50 30 L70 35 L85 25 L100 30 L100 60 Z" />
                    </svg>
                </div>
                <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-gradient-to-br from-yellow-200 to-orange-200 rounded-full opacity-90 shadow-sm" />
            </div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-300 z-30">
            <div className="bg-white/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                <Icon
                    icon="mdi:plus"
                    className="h-3 w-3 md:h-4 md:w-4 text-slate-600"
                />
            </div>
        </div>

        <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transform translate-y-6 rotate-12 group-hover:translate-y-0 group-hover:rotate-0 transition-all duration-800 delay-400 z-30">
            <div className="w-4 h-3 md:w-5 md:h-4 bg-gradient-to-br from-pink-200 to-pink-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-b from-pink-100 to-rose-200 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-pink-200/30" />
                </div>
            </div>
        </div>
        <div className="absolute -top-2 -right-6 opacity-0 group-hover:opacity-100 transform translate-y-8 rotate-45 group-hover:translate-y-0 group-hover:rotate-12 transition-all duration-900 delay-500 z-30">
            <div className="w-3 h-2.5 md:w-4 md:h-3 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-md shadow-lg border border-white/40 overflow-hidden">
                <div className="w-full h-full bg-gradient-to-b from-emerald-100 to-teal-200 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-emerald-200/30" />
                </div>
            </div>
        </div>
    </div>
);

const WatermarkUploadHero: React.FC<WatermarkUploadHeroProps> = ({
    mobile = false,
    dropzoneRef,
    onUpload,
}) => {
    const wrapperClass = mobile
        ? "group p-6 md:p-8 rounded-3xl text-slate-700 dark:text-slate-200 bg-white/20 dark:bg-black/40 backdrop-blur-xl cursor-pointer flex flex-col items-center hover:bg-white/30 dark:hover:bg-white/10 transition-all duration-500 shadow-2xl border border-white/30 hover:border-white/50 hover:shadow-3xl hover:scale-105 transform"
        : "group p-6 md:p-8 rounded-3xl text-slate-700 bg-white/20 backdrop-blur-xl cursor-pointer flex flex-col items-center hover:bg-white/30 transition-all duration-500 shadow-2xl border border-white/30 hover:border-white/50 hover:shadow-3xl hover:scale-105 transform";
    const titleClass = mobile
        ? "text-base md:text-lg font-light tracking-wide text-slate-700/90 dark:text-slate-200/90 text-center group-hover:text-slate-800 dark:group-hover:text-white transition-colors duration-300"
        : "text-base md:text-lg font-light tracking-wide text-slate-700/90 text-center group-hover:text-slate-800 transition-colors duration-300";
    const subtitleClass = mobile
        ? "text-xs md:text-sm text-slate-600/70 dark:text-slate-400/70 mt-1 md:mt-2 text-center group-hover:text-slate-700/80 dark:group-hover:text-slate-300/80 transition-colors duration-300"
        : "text-xs md:text-sm text-slate-600/70 mt-1 md:mt-2 text-center group-hover:text-slate-700/80 transition-colors duration-300";

    return (
        <ChineseWaveBackground>
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                <ImageUploader
                    ref={dropzoneRef}
                    onUpload={onUpload}
                    fileType="背景"
                >
                    <div className={wrapperClass}>
                        {mobile ? <MobileIllustration /> : <DesktopIllustration />}

                        <span className={titleClass}>
                            上传背景图片
                        </span>
                        <span className={subtitleClass}>
                            支持 JPG、PNG、TIFF 格式
                        </span>

                        {mobile && (
                            <div className="mt-2 md:hidden">
                                <span className="text-xs text-slate-500/60 group-hover:text-slate-600/80 transition-colors duration-300">
                                    轻触上传
                                </span>
                            </div>
                        )}
                    </div>
                </ImageUploader>
            </div>
        </ChineseWaveBackground>
    );
};

export default WatermarkUploadHero;
