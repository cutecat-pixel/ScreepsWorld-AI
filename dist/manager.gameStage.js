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
            wallRepairer: 0,
            transfer: 0
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
            defender: 0,
            wallRepairer: 0,
            transfer: 0
        }
    },

    // 中期阶段：开始使用专门的矿工和运输者
    MIDGAME: {
        name: '中期阶段',
        level: 3,
        creepCounts: {
            harvester: 0,
            upgrader: 2,
            builder: 1,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 0
        }
    },

    // 高级阶段：完整的自动化和防御系统
    ADVANCED: {
        name: '高级阶段',
        level: 4,
        creepCounts: {
            harvester: 0,
            upgrader: 2,
            builder: 2,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 2
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
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 2
        }
    },

    // 矿物开发阶段：开始提取并处理矿物
    MINERAL: {
        name: '矿物阶段',
        level: 6,
        creepCounts: {
            harvester: 0,
            upgrader: 2,
            builder: 1,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 1,
            mineralHarvester: 0, // 默认值0，在有Extractor时动态调整
            mineralHauler: 0,     // 默认值0，在有Extractor时动态调整
            terminalHauler: 1
        }
    },

    // 终极阶段：全面发展与优化
    END: {
        name: '终极阶段',
        level: 7,
        creepCounts: {
            harvester: 0,
            upgrader: 1,
            builder: 1,
            repairer: 1,
            miner: 2,
            hauler: 2,
            defender: 0,
            wallRepairer: 1,
            transfer: 1,
            mineralHarvester: 0, // 默认值0，在有Extractor时动态调整
            mineralHauler: 0 ,    // 默认值0，在有Extractor时动态调整
            terminalHauler: 1
        }
    }
};

/**
 * 计算指定房间的游戏阶段
 * @param {Room} room - 要计算阶段的房间对象
 * @returns {Object} 游戏阶段对象
 */
function getRoomStage(room) {
    // 初始化默认为EARLY阶段
    let roomStage = GAME_STAGES.EARLY;

    // 检查房间是否存在及是否被我们控制
    if(!room || !room.controller || !room.controller.my) {
        return roomStage;
    }

    // 基于控制器等级初步判断
    if(room.controller.level >= 8) {
        roomStage = GAME_STAGES.END;
    }
    else if(room.controller.level >= 6) {
        roomStage = GAME_STAGES.MINERAL;
    }
    else if(room.controller.level >= 5) {
        roomStage = GAME_STAGES.LATE;
    }
    else if(room.controller.level >= 4) {
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

    // 检查该房间是否受到攻击，如果是，调整防御者需求
    if(Memory.roomData && Memory.roomData[room.name] && Memory.roomData[room.name].underAttack) {
        // 创建一个新对象以避免修改原始常量
        roomStage = Object.assign({}, roomStage);
        roomStage.creepCounts = Object.assign({}, roomStage.creepCounts);

        // 判断是否有塔且塔能量充足
        let needExtraDefenders = false;

        // 如果处于中期或以上阶段，检查塔的能量
        if(roomStage.level >= 3) {
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            });

            // 检查塔的能量状况
            if(towers.length === 0) {
                // 如果没有塔，需要额外的防御者
                needExtraDefenders = true;
            } else {
                // 检查所有塔的能量状况
                for(const tower of towers) {
                    if(tower.store[RESOURCE_ENERGY] < tower.store.getCapacity(RESOURCE_ENERGY) * 0.1) {
                        needExtraDefenders = true;
                        break;
                    }
                }
            }
        } else {
            // 早期阶段始终需要额外防御者
            needExtraDefenders = true;
        }

        if(needExtraDefenders) {
            roomStage.creepCounts.defender += 1; // 额外增加1个防御者
        }
    }

    return roomStage;
}

/**
 * 计算当前游戏阶段
 * @param {Room} [room] - 可选的房间对象参数，如果提供则返回该房间的阶段
 * @returns {Object} 游戏阶段对象
 */
function getCurrentStage(room) {
    // 如果提供了特定房间，返回该房间的阶段
    if(room) {
        return getRoomStage(room);
    }

    // 向后兼容：如果没有提供房间，返回所有房间中的最高阶段
    let currentStage = GAME_STAGES.EARLY;

    // 遍历所有房间
    for(let name in Game.rooms) {
        const room = Game.rooms[name];

        // 只检查我们控制的房间
        if(!room.controller || !room.controller.my) continue;

        // 获取该房间的阶段
        const roomStage = getRoomStage(room);

        // 如果这个房间的阶段比当前计算的高，更新当前阶段
        if(roomStage.level > currentStage.level) {
            currentStage = roomStage;
        }
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

    // 3. 处理防御者的生成逻辑
    if(isUnderAttack) {
        // 如果房间正在被攻击
        if(room.controller.level >= 3) {
            // 查找房间中的敌对creeps
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            
            // 检查是否有带HEAL部件的入侵者
            let hasHealers = false;
            for(const hostile of hostiles) {
                // 统计HEAL部件数量
                const healParts = hostile.body.filter(part => part.type === HEAL).length;
                if(healParts > 0) {
                    hasHealers = true;
                    break;
                }
            }
            
            // 如果有带HEAL部件的入侵者，直接设置防御者数量为2
            if(hasHealers) {
                targetCounts.defender = 2;
            }
        } 
        else {
            // 低等级房间直接增加防御者
            targetCounts.defender += 1;
        }
    }

    // 4. 矿物采集者和运输者的生成逻辑
    if(gameStage.level >= 6) { // 只有RCL 6级以上才考虑矿物处理
        // 检查房间中是否有Extractor
        const extractors = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTRACTOR
        });

        if(extractors.length > 0) {

            // 有Extractor，检查矿物是否有效
            const minerals = room.find(FIND_MINERALS);

            if(minerals.length > 0) {

                if(minerals[0].mineralAmount > 0) {
                    // 矿物存在且有矿物量，需要矿物采集者和运输者
                    // 检查矿物附近是否有容器
                    const mineral = minerals[0];
                    const containers = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    });

                    // 检查是否有建设中的容器
                    const containerSites = mineral.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER
                    });

                    if(containers.length > 0) {
                        // 有容器，启用矿物采集和运输
                        targetCounts.mineralHarvester = 1;
                        targetCounts.mineralHauler = 1;
                    }
                }
            }
        }
    }

    // 6. Lab Hauler 的生成逻辑 (新增)
    if (gameStage.level >= 6 && room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).length >= 3) {
        // 检查是否有待处理的Lab任务
        const hasLabTasks = room.memory.labTasks && room.memory.labTasks.length > 0;

        if (hasLabTasks) {
            targetCounts.labHauler = 1; // 如果有任务，需要一个 Lab Hauler
        } else {
            targetCounts.labHauler = 0; // 没有任务则不需要
        }
    } else {
        targetCounts.labHauler = 0; // 等级不够或Lab不足则不需要
    }

    // 终端运输者的生成逻辑 (新增)
    if (gameStage.level >= 6) {
        // 检查房间内是否有STORAGE和CONTROLLER附近的LINK
        let hasLinks = false;
        if (room.memory.links && room.memory.links.storage && room.memory.links.controller) {
            const storageLink = Game.getObjectById(room.memory.links.storage);
            const controllerLink = Game.getObjectById(room.memory.links.controller);
            if (storageLink && controllerLink) {
                hasLinks = true;
            }
        }

        // RCL 6及以上，只要有终端或者有LINK网络，就需要终端运输者
        if (room.terminal || hasLinks) {
            targetCounts.terminalHauler = 1;
        }
    }

    // 7. 处理Storage Hauler的生成逻辑
    if(room.memory.remoteHaulerConfig) {
        let totalStorageHaulers = 0;
        // 根据目标房间统计需要的运输者数量
        for(const targetRoomName in room.memory.storageHaulers) {
            // 确保这个房间对应的配置存在
            if(room.memory.storageHaulers[targetRoomName]) {
                // 获取需要的remoteHauler数量
                const count = room.memory.storageHaulers[targetRoomName].count || 0;

                // 添加到目标数量中
                totalStorageHaulers += count;

                // 确保创建remoteHauler所需的配置
                if(!Memory.creepConfigs) Memory.creepConfigs = {};
                if(!Memory.creepConfigs.remoteHauler) Memory.creepConfigs.remoteHauler = {};
                if(!Memory.creepConfigs.remoteHauler[room.name]) Memory.creepConfigs.remoteHauler[room.name] = {};

                // 设置或更新配置
                Memory.creepConfigs.remoteHauler[room.name] = {
                    targetRoom: targetRoomName,
                    storageHauler: true,
                    priority: room.memory.storageHaulers[targetRoomName].priority || 2
                };
            }
        }
        targetCounts.remoteHauler = totalStorageHaulers;
    }

    // 4. 根据LINK的存在调整Transfer的数量
    if(gameStage.level >= 6) { // RCL 5或以上才可能有多个LINK
        // 检查房间中LINK的数量
        const linkCount = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;

        // 默认值为2
        targetCounts.transfer = 2;

        // 移除linkCount >= 3的条件，对任何数量的LINK都进行检查
        // 检查所有容器是否有LINK在附近
        // 先找出所有矿物位置
        const minerals = room.find(FIND_MINERALS);

        // 找出不在矿物附近的容器
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        }).filter(container => {
            // 对每个容器检查是否在任何矿物附近
            for (const mineral of minerals) {
                if (container.pos.inRangeTo(mineral, 1)) {
                    return false; // 如果容器靠近矿物，排除它
                }
            }
            return true; // 容器不靠近任何矿物
        });

        let containersWithoutLink = 0;

        for(const container of containers) {
            const nearbyLinks = container.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                filter: s => s.structureType === STRUCTURE_LINK
            });

            if(nearbyLinks.length === 0) {
                containersWithoutLink++;
            }
        }

        // 根据没有LINK的容器数量调整transfer数量
        if (containersWithoutLink === 1) {
            targetCounts.transfer = 1;
        }
        // 如果没有没有LINK的容器，不需要Transfer
        else if(containersWithoutLink === 0) {
            targetCounts.transfer = 0;
        }
    }

    return targetCounts;
}

module.exports = {
    getCurrentStage,
    getCreepCountsByRole,
    GAME_STAGES
};
