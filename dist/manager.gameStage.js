/**
 * 游戏阶段管理器
 * 负责判断当前游戏阶段并返回相应的配置
 */

// 游戏阶段定义
const GAME_STAGES = {
    // 初始阶段：开始阶段，只有基本的采集和升级能力
    EARLY: {
        name: '早期阶段',
        level: 1,
        // 各种角色的目标数量
        creepCounts: {
            harvester: 2,
            upgrader: 2,
            builder: 1,
            repairer: 0,
            miner: 0,
            hauler: 0,
            defender: 0,
            wallRepairer: 0
        }
    },
    
    // 发展阶段：开始建造更多基础设施
    DEVELOPING: {
        name: '发展阶段',
        level: 2,
        creepCounts: {
            harvester: 3,
            upgrader: 2,
            builder: 2,
            repairer: 1,
            miner: 0,
            hauler: 0,
            defender: 1,
            wallRepairer: 0
        }
    },
    
    // 中期阶段：开始使用专门的矿工和运输者
    MIDGAME: {
        name: '中期阶段',
        level: 3,
        creepCounts: {
            harvester: 1,
            upgrader: 3,
            builder: 2,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 1,
            wallRepairer: 1
        }
    },
    
    // 高级阶段：完整的自动化和防御系统
    ADVANCED: {
        name: '高级阶段',
        level: 4,
        creepCounts: {
            harvester: 0,
            upgrader: 3,
            builder: 2,
            repairer: 2,
            miner: 2,
            hauler: 3,
            defender: 2,
            wallRepairer: 1
        }
    },
    
    // 后期阶段：高度优化，准备扩张
    LATE: {
        name: '后期阶段',
        level: 5,
        creepCounts: {
            harvester: 0,
            upgrader: 2,
            builder: 2,
            repairer: 1,
            miner: 3,
            hauler: 4,
            defender: 2,
            wallRepairer: 1
        }
    }
};

/**
 * 计算当前游戏阶段
 * @returns {Object} 游戏阶段对象
 */
function getCurrentStage() {
    // 初始化默认为EARLY阶段
    let currentStage = GAME_STAGES.EARLY;
    
    // 遍历所有房间
    for(let name in Game.rooms) {
        const room = Game.rooms[name];
        
        // 只检查我们控制的房间
        if(!room.controller || !room.controller.my) continue;
        
        // 基于控制器等级初步判断
        let roomStage;
        if(room.controller.level >= 7) {
            roomStage = GAME_STAGES.LATE;
        } 
        else if(room.controller.level >= 5) {
            roomStage = GAME_STAGES.ADVANCED;
        }
        else if(room.controller.level >= 3) {
            // 中期阶段判断更复杂，需要检查一些关键结构
            const containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            }).length;
            
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            }).length;
            
            if(containers >= 2 && towers >= 1) {
                roomStage = GAME_STAGES.MIDGAME;
            } else {
                roomStage = GAME_STAGES.DEVELOPING;
            }
        }
        else if(room.controller.level >= 2) {
            roomStage = GAME_STAGES.DEVELOPING;
        }
        else {
            roomStage = GAME_STAGES.EARLY;
        }
        
        // 如果这个房间的阶段比当前计算的高，更新当前阶段
        if(roomStage.level > currentStage.level) {
            currentStage = roomStage;
        }
    }
    
    // 检查是否受到攻击，如果是，增加防御者需求
    const roomsUnderAttack = _.filter(Memory.roomData || {}, data => data.underAttack);
    if(roomsUnderAttack.length > 0) {
        // 创建一个新对象以避免修改原始常量
        currentStage = Object.assign({}, currentStage);
        currentStage.creepCounts = Object.assign({}, currentStage.creepCounts);
        currentStage.creepCounts.defender += 2; // 增加防御者数量
    }
    
    return currentStage;
}

// 根据房间和游戏阶段获取每种角色的目标数量
function getCreepCountsByRole(room, gameStage) {
    // 检查是否是战争状态
    const isUnderAttack = Memory.roomData && 
                         Memory.roomData[room.name] && 
                         Memory.roomData[room.name].underAttack;
    
    // 创建副本以避免修改原始对象
    let targetCounts = Object.assign({}, gameStage.creepCounts);
    
    // 根据房间具体情况调整数量
    
    // 1. 检查源的数量，调整矿工数量
    if(gameStage.level >= 3) { // 只有中期以上才使用专门的矿工
        const sourceCount = room.find(FIND_SOURCES).length;
        targetCounts.miner = Math.min(sourceCount, targetCounts.miner);
    }
    
    // 2. 根据建筑工地数量调整建造者数量
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    if(constructionSites === 0) {
        targetCounts.builder = Math.max(1, targetCounts.builder - 1);
    }
    
    // 3. 如果受到攻击，增加防御者
    if(isUnderAttack) {
        targetCounts.defender += 2;
    }
    
    return targetCounts;
}

module.exports = {
    getCurrentStage,
    getCreepCountsByRole,
    GAME_STAGES
}; 