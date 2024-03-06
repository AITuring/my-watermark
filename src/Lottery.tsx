import { useEffect, useState } from "react";
import { Button } from "antd";
import JSONDataExtractor from "./JSONDataExtractor";

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

  const handleDataExtracted = (data) => {
    setExtractedData(data);
    // 在这里可以处理数据，例如存储到状态中或进行其他操作
  };
  // 转发用户名单
  const [result, setResult] = useState([]);
  // 随机抽取10个用户
  const getLottery = () => {
    const randomArray = getRandomNames(uniqueArray, 4);
    setResult(randomArray);
  };

  useEffect(() => {
    const uniqueArray = extractedData.map((item) => item.user.screen_name);
    setUniqueArray([...new Set(uniqueArray)]);
  }, [extractedData]);

  return (
    <>
      <JSONDataExtractor onDataExtracted={handleDataExtracted} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <h2>转发用户名单</h2>
        <div>一共{uniqueArray.length}人</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            // justifyContent: "space-between",
            alignItems: "center",
            margin: "20px 0",
          }}
        >
          {uniqueArray.map((item) => (
            <div style={{ margin: "4px 20px" }}>{item}</div>
          ))}
        </div>
        <Button type="primary" size="large" onClick={getLottery}>
          抽奖
        </Button>
        <h2>抽奖结果</h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            // justifyContent: "space-between",
            alignItems: "center",
            margin: "20px 0",
          }}
        >
          {result.map((item) => (
            <div style={{ margin: "4px 20px" }}>{item}</div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Lottery;
