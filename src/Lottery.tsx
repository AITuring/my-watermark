import { useEffect, useState } from "react";
import { CustomButton, InputNum } from "./components";
import confetti from "canvas-confetti";

function getRandomNames(namesArray, m) {
    // 创建一个名字数组的副本，避免修改原数组
    const namesCopy = [...namesArray];

    // 随机抽取m个名字
    const result = [];
    for (let i = 0; i < Math.min(m, namesCopy.length); i++) {
        // 从数组中随机选择一个索引
        const randomIndex = Math.floor(Math.random() * namesCopy.length);
        // 从数组中取出一个名字，然后将其从数组中移除，以避免重复
        result.push(namesCopy.splice(randomIndex, 1)[0]);
    }

    return result;
}

const Lottery = () => {
    const [extractedData, setExtractedData] = useState([]);
    const [uniqueArray, setUniqueArray] = useState([]);
    const [count, setCount] = useState(10);

    const [jsonInput, setJsonInput] = useState("");

    const handleInputChange = (event) => {
        setJsonInput(event.target.value);
    };

    const combineData = () => {
        const jsonObjects = [];
        const jsonString = jsonInput;
        let depth = 0;
        let start = 0; // JSON对象的起始位置

        // 查找独立的JSON对象
        for (let i = 0; i < jsonString.length; i++) {
            if (jsonString[i] === "{") {
                if (depth === 0) {
                    start = i; // 记录当前JSON对象的起始位置
                }
                depth++;
            } else if (jsonString[i] === "}") {
                depth--;
                if (depth === 0) {
                    // 当括号平衡时，我们找到了一个独立的JSON对象
                    const jsonStr = jsonString.slice(start, i + 1);
                    jsonObjects.push(jsonStr);
                }
            }
        }

        // 新数组用于存储合并后的数据
        let combinedData = [];

        // 处理每个独立的JSON字符串
        jsonObjects.forEach((jsonStr) => {
            try {
                const jsonObject = JSON.parse(jsonStr);
                if ("data" in jsonObject) {
                    combinedData = combinedData.concat(jsonObject.data);
                } else {
                    console.error('JSON does not contain "data" property.');
                }
            } catch (error) {
                console.error("Failed to parse JSON:", error);
                // 可以在这里通知用户某个特定的JSON对象无法解析
            }
        });

        // 调用父组件的回调函数，传递合并后的数据
        handleDataExtracted(combinedData);
    };

    const handleDataExtracted = (data) => {
        setExtractedData(data);
        // 在这里可以处理数据，例如存储到状态中或进行其他操作
    };
    // 转发用户名单
    const [result, setResult] = useState([]);
    // 随机抽取10个用户
    const getLottery = () => {
        const randomArray = getRandomNames(uniqueArray, count);
        setResult(randomArray);
        confetti({
            particleCount: 600,
            spread: 360,
        });
    };

    useEffect(() => {
        const uniqueArray = extractedData.map((item) => item.user.screen_name);

        setUniqueArray([...new Set(uniqueArray)]);
    }, [extractedData]);

    return (
        <>
            <div className="my-4 flex flex-col items-center">
                <h2>转发用户数据</h2>

                <textarea
                    value={jsonInput}
                    onChange={handleInputChange}
                    // minRows={20}
                    cols={50}
                    className="shadow-xl m-4 p-2 rounded w-11/12 h-52 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:shadow-outline-blue resize-y transition duration-300 ease-in-out dark:bg-gray-700 dark:text-white"
                    placeholder="打开网页端微博控制台，在网络一栏复制repostTimeline的响应数据，粘贴到文本框中，每段数据之间回车隔开"
                />

                <CustomButton variant="outlined" onClick={combineData}>
                    获取转发名单
                </CustomButton>
            </div>
            <div className="flex items-center flex-col">
                <h2 className="my-4">转发用户名单</h2>
                <div>一共{uniqueArray.length}人</div>
                {uniqueArray.length > 0 && (
                    <div className="m-5 w-11/12 shadow-xl transition duration-250 ease-in-out rounded-lg p-4 flex flex-col overflow-hidden">
                            <div className="flex flex-wrap items-center">
                                {uniqueArray.map((item, id) => (
                                    <div className="mx-5 my-3" key={id}>
                                        {item}
                                    </div>
                                ))}
                            </div>

                    </div>
                )}
                <div className="flex items-center justify-between my-4">
                    <div className="flex items-center">
                        <h2>抽奖人数:</h2>
                        <InputNum
                            step={1}
                            min={1}
                            value={count}
                            onChange={e => setCount(e)}
                            max={uniqueArray.length ? uniqueArray.length : 1}
                            className="mx-2 w-[160px]"

                        />
                    </div>
                    <CustomButton
                        color="primary"
                        variant="contained"
                        onClick={getLottery}
                        disabled={uniqueArray.length === 0}
                    >
                        抽奖
                    </CustomButton>
                </div>
                <h2 className="my-4">抽奖结果</h2>
                {uniqueArray.length > 0 && (
                    <div className="m-5 w-11/12 shadow-xl transition duration-250 ease-in-out rounded-lg p-4 flex flex-col overflow-hidden">
                            <div className="my-4 flex flex-wrap items-center">
                                {result.map((item, id) => (
                                    <div className="mx-5 my-3" key={id}>
                                        @{item}
                                    </div>
                                ))}
                            </div>

                    </div>
                )}
            </div>
        </>
    );
};

export default Lottery;
