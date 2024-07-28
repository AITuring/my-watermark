import { CustomButton, InputNum } from "./components";
import { CircleX, ImageUp, FolderX } from "lucide-react";

const CompTest = () => {
    return (
        <>
            <div className="flex items-center space-x-4 bg-current p-4 m-4">
                <CustomButton
                    variant="contained"
                    // color="primary"
                    size="small"
                    icon="FolderX"
                >
                    小
                </CustomButton>

                <CustomButton
                    variant="contained"
                    // color="primary"
                    size="medium"
                    icon="FolderX"
                >
                    中
                </CustomButton>

                <CustomButton
                    variant="contained"
                    // color="primary"
                    size="large"
                    icon="FolderX"
                >
                    大
                </CustomButton>
                <CustomButton
                    variant="contained"
                    // color="primary"
                    size="xlarge"
                    icon="FolderX"
                >
                    超大
                </CustomButton>
            </div>
            <div className="flex items-center space-x-4 bg-current p-4 m-4">
                <InputNum step={10} value={0} onChange={e => console.log(e)} min={1} max={20}/>
            </div>
        </>
    );
};

export default CompTest;
