/*
 * 移动管理器：集成优化的移动系统
 * 这个模块包装了移动更新库，提供更高效的寻路和移动功能
 */

// 导入优化的移动模块
const moveUpdate = require('move.update.hotfix 0.9.4');

// 配置模块参数
const configure = () => {
    // 确保移动系统已配置
    moveUpdate.setChangeMoveTo(true);
};

// 初始化模块
const initialize = () => {
    // 初始化移动系统
    configure();
    console.log('✅ 移动优化系统已加载');
};

// 清理特定房间的路径缓存
const clearPathsInRoom = (roomName) => {
    return moveUpdate.deletePathInRoom(roomName);
};

// 添加要避开的房间
const addRoomToAvoid = (roomName) => {
    return moveUpdate.addAvoidRooms(roomName);
};

// 从避开列表中移除房间
const removeRoomToAvoid = (roomName) => {
    return moveUpdate.deleteAvoidRooms(roomName);
};

// 清理指定房间的costMatrix
const clearRoomCostMatrix = (roomName) => {
    return moveUpdate.deleteCostMatrix(roomName);
};

// 打印优化系统的性能统计
const printStats = () => {
    return moveUpdate.print();
};

module.exports = {
    initialize,
    clearPathsInRoom,
    addRoomToAvoid,
    removeRoomToAvoid,
    clearRoomCostMatrix,
    printStats
}; 