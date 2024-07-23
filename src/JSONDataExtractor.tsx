import { useState } from "react";
import { Button, Textarea } from "@nextui-org/react";

interface JSONDataExtractorProps {
    onDataExtracted: (data) => void;
}

const JSONDataExtractor: React.FC<JSONDataExtractorProps> = ({
    onDataExtracted,
}) => {
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
        onDataExtracted(combinedData);
    };

    return (
        <div className="my-4 flex flex-col items-center">
            <h2>转发用户数据</h2>

            <Textarea
                value={jsonInput}
                onChange={handleInputChange}
                minRows={20}
                cols={50}
                className="m-4 rounded w-11/12"
                placeholder="打开网页端微博控制台，在网络一栏复制repostTimeline的响应数据，粘贴到文本框中，每段数据之间回车隔开"
            />

            <Button variant="bordered" onClick={combineData}>
                获取转发名单
            </Button>
        </div>
    );
};

export default JSONDataExtractor;
