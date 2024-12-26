import { ReactNode, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import DarkToggle from "@/components/DarkToggle";

import { cn } from "@/lib/utils";

interface TabProps {
    text: string;
    selected: boolean;
    setSelected: React.Dispatch<React.SetStateAction<string>>;
    id: string;
    url: string;
}

interface TabDataProp {
    label: string;
    id: string;
    url: string;
    component: ReactNode;
}

export default function NavTabs({ tabs }: { tabs: TabDataProp[] }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [selected, setSelected] = useState<string>(tabs[0].id);

    useEffect(() => {
        // 根据当前 URL 找到匹配的 tab
        const currentTab = tabs.find(tab => tab.url === location.pathname);
        if (currentTab) {
            setSelected(currentTab.id);
        }
    }, [location.pathname, tabs]);

    return (
        <div className="flex items-center justify-between gap-4 bg-violet-950 py-4 px-8 h-[8vh]">
            <div className="flex items-center justify-center gap-4">
                {tabs.map((tab) => (
                    <Tab
                        text={tab.label}
                        selected={selected === tab.id}
                        setSelected={() => {
                            setSelected(tab.id);
                            navigate(tab.url, { replace: true });
                        }}
                        id={tab.id}
                        key={tab.id}
                        url={tab.url}
                    />
                ))}
            </div>
            <DarkToggle />
        </div>
    );
}

const Tab = ({ text, selected, setSelected, id, url }: TabProps) => {

    return (
        <button
            onClick={() => {
                setSelected(id)
            }}
            className={cn(
                "relative rounded-md p-2 text-sm transition-all",
                selected ? "text-white" : "text-slate-300 hover:font-black"
            )}
        >
            <Link to={url} className="relative z-50 min-w-20">{text}</Link>
            {selected && (
                <motion.span
                    layoutId="tabs"
                    transition={{ type: "spring", duration: 0.5 }}
                    className="absolute inset-0 rounded-sm bg-gradient-to-r from-indigo-600 to-pink-600"
                />
            )}
        </button>
    );
};
