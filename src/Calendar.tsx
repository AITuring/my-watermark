import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GenerativeBackground, { GenerativeBackgroundHandle } from './components/GenerativeBackground';

const NumberColumn = ({ digit }: { digit: string }) => {
    return (
        <div className="relative h-[1.1em] w-[0.65em] inline-flex justify-center overflow-hidden">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={digit}
                    initial={{ y: "100%", opacity: 0, filter: "blur(4px)" }}
                    animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: "-100%", opacity: 0, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    {digit}
                </motion.span>
            </AnimatePresence>
            <span className="invisible">{digit}</span>
        </div>
    );
};

const TimeGroup = ({ value }: { value: string }) => (
    <div className="flex">
        {value.split('').map((digit, i) => (
            <NumberColumn key={i} digit={digit} />
        ))}
    </div>
);

const Calendar: React.FC = () => {
    const [date, setDate] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<GenerativeBackgroundHandle>(null);
    const secondsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setDate(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Only spawn a duck every 5 seconds
        if (date.getSeconds() % 5 !== 0) return;

        if (backgroundRef.current && secondsRef.current) {
            const secondsRect = secondsRef.current.getBoundingClientRect();
            const centerX = secondsRect.left + secondsRect.width / 2;
            // Spawn at the top of the water (horizon), but slightly down so it's not clipped.
            // The water canvas starts at 50vh (window.innerHeight / 2).
            // We add ~40px to ensure the duck is fully visible and hits a valid layer.
            const spawnY = (window.innerHeight / 2) + 40;
            backgroundRef.current.addDuck(centerX, spawnY);
        }
    }, [date]);


    // Formatters
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const weekDay = weekDays[date.getDay()];

    const timeStr = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const [hours, minutes, seconds] = timeStr.split(':');

    return (
        <div
            ref={containerRef}
            className="min-h-screen w-full bg-[#f4f1ea] text-[#2c2c2c] font-serif flex flex-col relative overflow-hidden select-none transition-colors duration-500"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23dcd9d1' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
        >

            {/* Top Half: Content */}
            <div className="h-[50vh] w-full flex items-end justify-center pb-20 relative z-10">
                <div className="flex flex-col items-center gap-2 font-mono text-stone-800 select-none">
                    {/* Date Row */}
                    <div className="flex items-center gap-4 text-lg md:text-xl opacity-70 tracking-wider">
                        <span>{year}.{month.toString().padStart(2, '0')}.{day.toString().padStart(2, '0')}</span>
                        <span className="w-px h-4 bg-stone-400"></span>
                        <span>{weekDay}</span>
                    </div>

                    {/* Time Row */}
                    <div className="flex items-center leading-none tracking-tight font-light">
                        <div className="text-6xl md:text-8xl tabular-nums">
                            <TimeGroup value={hours} />
                        </div>
                        <span className="text-6xl md:text-8xl animate-pulse mx-1 text-stone-400 pb-2">:</span>
                        <div className="text-6xl md:text-8xl tabular-nums">
                            <TimeGroup value={minutes} />
                        </div>
                        <span className="text-6xl md:text-8xl animate-pulse mx-1 text-stone-400 pb-2">:</span>
                        <div ref={secondsRef} className="text-6xl md:text-8xl tabular-nums">
                            <TimeGroup value={seconds} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Half: Background */}

                <GenerativeBackground ref={backgroundRef} />



            {/* Footer decoration */}
             <div className="absolute left-1/2 -translate-x-1/2 bottom-8 text-stone-400 text-xs  tracking-widest opacity-60">
                {/* TIME FLOWS LIKE A RIVER */}
                逝者如斯夫，不舍昼夜
            </div>
        </div>
    );
};

export default Calendar;
