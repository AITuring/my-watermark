"use client";
import { useState, useCallback } from "react";
import { Icon } from '@iconify/react';

interface IToggleSwitchProps {
    onChange?: (value: boolean) => void;
    defaultChecked?: boolean;
}

const ToggleSwitch = ({ onChange, defaultChecked }: IToggleSwitchProps) => {
    const [isChecked, setIsChecked] = useState<boolean>(
        defaultChecked ?? false
    );
    const handleCheckboxChange = useCallback(() => {
        const newCheckedState = !isChecked;
        setIsChecked(newCheckedState);
        onChange?.(newCheckedState);
    }, [isChecked]);

    return (
        <>
            <label className="flex cursor-pointer select-none items-center">
                <div className="relative">
                    <input
                        type="checkbox"
                        id="toggle-checkbox" // 添加一个id属性，用于隐式关联
                        checked={isChecked}
                        onChange={handleCheckboxChange}
                        className="sr-only"
                    />
                    <div
                        className={`box block h-6 w-14 rounded-full ${
                            isChecked ? "bg-indigo-500" : "bg-pink-500"
                        }`}
                    >
                        {isChecked && (
                            <Icon icon="line-md:moon-alt-to-sunny-outline-loop-transition" className="absolute left-1 top-1 flex items-center justify-center w-4 h-4 rounded-full"/>
                        )}
                    </div>
                    <div
                        className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full transition ${
                            isChecked
                                ? "translate-x-8 bg-gray-200"
                                : "bg-gray-200"
                        }`}
                    />
                    {!isChecked && (
                        <Icon icon="line-md:moon-rising-alt-loop" className="absolute right-1 top-1 flex items-center justify-center w-4 h-4 rounded-full" />
                    )}
                </div>
            </label>
        </>
    );
};

export default ToggleSwitch;
