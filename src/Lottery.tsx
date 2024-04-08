import { useEffect, useState } from "react";
import { Button, Card, CardBody, Input } from "@nextui-org/react";
import confetti from "canvas-confetti";
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
  const [count, setCount] = useState(10);

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
      <JSONDataExtractor onDataExtracted={handleDataExtracted} />
      <div className="flex items-center flex-col">
        <h2 className="my-4">转发用户名单</h2>
        <div>一共{uniqueArray.length}人</div>
        {uniqueArray.length > 0 && (
          <Card className="m-5 w-11/12">
            <CardBody>
              <div className="flex flex-wrap items-center">
                {uniqueArray.map((item, id) => (
                  <div className="mx-5 my-3" key={id}>
                    {item}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
        <div className="flex items-center justify-between my-4">
          <div className="flex items-center w-[200px]">
            <h2>抽奖人数:</h2>
            <Input
              type="number"
              label=""
              min={1}
              value={String(count)}
              onChange={(e) => setCount(Number(e.target.value))}
              max={uniqueArray.length ? uniqueArray.length : 1}
              className="w-1/2 mx-2"
              variant="flat"
            />
          </div>
          <Button
            color="primary"
            variant="shadow"
            onClick={getLottery}
            isDisabled={uniqueArray.length === 0}
          >
            抽奖
          </Button>
        </div>
        <h2 className="my-4">抽奖结果</h2>
        {uniqueArray.length > 0 && (
          <Card className="m-5 w-11/12">
            <CardBody>
              <div className="my-4 flex flex-wrap items-center">
                {result.map((item, id) => (
                  <div className="mx-5 my-3" key={id}>
                    @{item}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
};

export default Lottery;
