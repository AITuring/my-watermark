import React, { useState } from 'react';

const JSONDataExtractor = ({ onDataExtracted }) => {
  const [jsonInput, setJsonInput] = useState('');

  const handleInputChange = (event) => {
    setJsonInput(event.target.value);
  };

  const combineData = () => {
    let jsonObjects = [];
    let jsonString = jsonInput;
    let depth = 0;
    let start = 0; // JSON对象的起始位置

    // 查找独立的JSON对象
    for (let i = 0; i < jsonString.length; i++) {
      if (jsonString[i] === '{') {
        if (depth === 0) {
          start = i; // 记录当前JSON对象的起始位置
        }
        depth++;
      } else if (jsonString[i] === '}') {
        depth--;
        if (depth === 0) {
          // 当括号平衡时，我们找到了一个独立的JSON对象
          let jsonStr = jsonString.slice(start, i + 1);
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
        if (jsonObject.hasOwnProperty('data')) {
          combinedData = combinedData.concat(jsonObject.data);
        } else {
          console.error('JSON does not contain "data" property.');
        }
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        // 可以在这里通知用户某个特定的JSON对象无法解析
      }
    });

    // 调用父组件的回调函数，传递合并后的数据
    onDataExtracted(combinedData);
  };


  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
      <h2>转发用户数据</h2>

      <textarea
        value={jsonInput}
        onChange={handleInputChange}
        rows={10}
        cols={50}
        style={{
          margin: '20px 0',
          width: '90vw',
        }}
        placeholder="粘贴用户转发数据"
      />

      <button onClick={combineData}>获取转发名单</button>
    </div>
  );
};

export default JSONDataExtractor;
