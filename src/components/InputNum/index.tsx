import React, { useState } from "react";
import classNames from "classnames";
// TODO 步长设置目前不生效

// 定义组件的props类型
interface InputNumProps {
    step?: number;
    value?: number;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    className?: string;
}

// InputNum组件
const InputNum: React.FC<InputNumProps> = ({
    step = 1,
    value: initialValue,
    onChange,
    min,
    max,
    className,
}) => {
    const [inputValue, setInputValue] = useState<number>(initialValue || 0);

    // 格式化输入值为数字
    const formatInputValue = (value: string): string => {
        const num = parseFloat(value);
        return isNaN(num) ? "" : num.toString();
    };

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = formatInputValue(e.target.value);
        console.log(newValue);
        if (parseFloat(newValue) >= max) {
            setInputValue(max);
            return;
        }
        if (parseFloat(newValue) <= min) {
            setInputValue(min);
            return;
        }

        setInputValue(parseFloat(newValue));
        onChange && onChange(parseFloat(newValue));
    };

    // 增加数值
    const handleIncrease = () => {
        const newValue = inputValue + step;
        setInputValue(newValue);
        onChange && onChange(newValue);
    };

    // 减少数值
    const handleDecrease = () => {
        const newValue = inputValue - step;
        setInputValue(newValue);
        onChange && onChange(newValue);
    };

    return (
        <div className="relative">
            <label htmlFor="inputNum" className="sr-only">
                Number Input
            </label>
            <input
                id="inputNum"
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                className={
                    classNames(
                        "shadow-xl w-full p-2 rounded-lg border outline-none border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:shadow-outline-blue transition-colors disabled:opacity-50",
                        className
                    )
                }
                aria-label="Number input with increment and decrement buttons"
                inputMode="numeric"
                placeholder={initialValue + ''}
            />
            {/* <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                    onClick={handleIncrease}
                    className="text-gray-600 hover:text-gray-900 focus:outline-none"
                    aria-label="Increase"
                >
                    +
                </button>
                <button
                    onClick={handleDecrease}
                    className="text-gray-600 hover:text-gray-900 focus:outline-none"
                    aria-label="Decrease"
                >
                    -
                </button>
            </div> */}
        </div>
    );
};

export default InputNum;
