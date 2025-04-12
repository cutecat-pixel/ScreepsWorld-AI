const utils = require('utils');

/**
 * 远程运输者角色模块
 * 负责从远程房间（通常是被预定的房间）收集能量，并将其运输回主房间
 */
const roleRemoteHauler = {
    /**
     * RemoteHauler的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 状态切换逻辑，带有自定义提示信息
        utils.switchWorkState(creep, '🔄 收集', '📦 运输');
        
        // 如果在工作模式（分发能量）需要回到主房间
        if(creep.memory.working) {
            // 如果不在主房间，返回主房间
            if(creep.memory.homeRoom && creep.room.name !== creep.memory.homeRoom) {
                // 使用安全的房间导航方法
                this.moveToRoom(creep, creep.memory.homeRoom, '#ffffff');
                return;
            }

            // 已经在主房间，寻找需要能量的建筑
            const target = creep.room.find(FIND_STRUCTURES, {
                filter: s => (s.structureType === STRUCTURE_STORAGE) && 
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];

            if(target) {
                // 尝试将能量转移到目标
                if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }

            // 如果所有建筑都满了，检查是否主房间所有能量存储设施都满了
            else {
                // 换到待命状态
                creep.memory.waiting = true;
                    
                // 移动到房间中心待命区域
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffff00'},
                    range: 10
                });
            }
        }
        // 如果在收集模式，需要去目标房间收集能量
        else {
            // 清除待命状态
            creep.memory.waiting = false;
            
            // 如果不在目标房间，前往目标房间
            if(creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom) {
                // 使用安全的房间导航方法
                this.moveToRoom(creep, creep.memory.targetRoom, '#ffaa00');
                return;
            }
            
            // 判断是否是专门从Storage搬运的运输者
            if(creep.memory.storageHauler) {
                // 查找目标房间的Storage
                const storage = creep.room.storage;
                
                if(storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    // 从Storage提取能量
                    if(creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                    return;
                } else {
                    // 如果Storage不存在或没有能量，显示提示
                    creep.say('❓Storage');
                    
                    // 移动到房间中心等待
                    creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        range: 10
                    });
                    return;
                }
            }
            
            // 已经在目标房间，寻找能量来源
            // 优先考虑从容器、墓碑或掉落的资源中获取能量
            let source = null;
            
            // 查找装满能量的容器
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && 
                          s.store.getUsedCapacity(RESOURCE_ENERGY) > 50
            });
            
            // 按照能量量排序容器
            if(containers.length > 0) {
                containers.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));
                source = containers[0];
            }
            
            // 如果没有合适的容器，查找掉落的资源
            if(!source) {
                const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
                    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 100
                });
                
                if(droppedResources.length > 0) {
                    // 按照数量排序资源
                    droppedResources.sort((a, b) => b.amount - a.amount);
                    source = droppedResources[0];
                }
            }
            
            // 如果没有掉落的资源，查找墓碑
            if(!source) {
                const tombstones = creep.room.find(FIND_TOMBSTONES, {
                    filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                });
                
                if(tombstones.length > 0) {
                    source = tombstones[0];
                }
            }
            
            // 如果找到了能量源
            if(source) {
                let actionResult;
                
                // 根据源类型执行不同的操作
                if(source.store) {
                    // 容器或墓碑
                    actionResult = creep.withdraw(source, RESOURCE_ENERGY);
                } else {
                    // 掉落的资源
                    actionResult = creep.pickup(source);
                }
                
                if(actionResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
            // 如果找不到能量源，移动到房间中心等待
            else {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    range: 10
                });
            }
        }
    },
    
    /**
     * 安全的房间间移动方法
     * @param {Creep} creep - 要移动的creep
     * @param {string} targetRoomName - 目标房间名称
     * @param {string} pathColor - 路径可视化颜色
     */
    moveToRoom: function(creep, targetRoomName, pathColor) {
        // 首先检查是否有保存的出口方向
        if(!creep.memory._exitDir || !creep.memory._exitPos) {
            // 尝试找到出口方向
            const exitDir = Game.map.findExit(creep.room, targetRoomName);
            
            // 检查是否成功找到出口方向
            if(exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) {
                // 如果找不到路径，可能由于房间未探索或其他原因
                creep.say('⚠️ 无路径');
                
                // 使用房间名称的排序规则直接计算大致方向
                const [currentX, currentY] = this.parseRoomName(creep.room.name);
                const [targetX, targetY] = this.parseRoomName(targetRoomName);
                
                // 计算大致方向
                let direction;
                if(targetX > currentX) direction = RIGHT;
                else if(targetX < currentX) direction = LEFT;
                else if(targetY > currentY) direction = BOTTOM;
                else direction = TOP;
                
                // 移动到该方向的边界
                this.moveToRoomEdge(creep, direction, pathColor);
                return;
            }
            
            // 找到到目标房间的出口
            const exit = creep.pos.findClosestByPath(exitDir);
            
            // 如果没有找到可达的出口（路径被阻塞或其他原因）
            if(!exit) {
                creep.say('⚠️ 无出口');
                
                // 移动到房间中心等待
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), {
                    visualizePathStyle: {stroke: pathColor},
                    range: 20
                });
                return;
            }
            
            // 保存出口方向和位置以便重用
            creep.memory._exitDir = exitDir;
            creep.memory._exitPos = {x: exit.x, y: exit.y};
        }
        
        // 使用已知的出口位置
        const exitPos = new RoomPosition(
            creep.memory._exitPos.x,
            creep.memory._exitPos.y,
            creep.room.name
        );
        
        // 移动到出口
        creep.moveTo(exitPos, {visualizePathStyle: {stroke: pathColor}});
        
        // 如果已到达出口附近，清除缓存的出口数据（为下一个房间做准备）
        if(creep.pos.isNearTo(exitPos)) {
            delete creep.memory._exitDir;
            delete creep.memory._exitPos;
        }
    },
    
    /**
     * 解析房间名称为坐标
     * @param {string} roomName - 房间名称，格式如"W1N2"
     * @returns {Array} - [x, y]坐标
     */
    parseRoomName: function(roomName) {
        let x = 0;
        let y = 0;
        const match = roomName.match(/([WE])(\d+)([NS])(\d+)/);
        
        if(match) {
            x = parseInt(match[2]);
            if(match[1] === 'W') x = -x;
            
            y = parseInt(match[4]);
            if(match[3] === 'N') y = -y;
        }
        
        return [x, y];
    },
    
    /**
     * 移动到房间边缘
     * @param {Creep} creep - 要移动的creep
     * @param {number} direction - 移动方向常量（TOP、RIGHT等）
     * @param {string} pathColor - 路径可视化颜色
     */
    moveToRoomEdge: function(creep, direction, pathColor) {
        let targetX = 25;
        let targetY = 25;
        
        // 根据方向设置目标位置在房间边缘
        switch(direction) {
            case TOP:
                targetY = 0;
                break;
            case BOTTOM:
                targetY = 49;
                break;
            case LEFT:
                targetX = 0;
                break;
            case RIGHT:
                targetX = 49;
                break;
        }
        
        // 移动到目标位置
        creep.moveTo(new RoomPosition(targetX, targetY, creep.room.name), {
            visualizePathStyle: {stroke: pathColor}
        });
    },
    
    /**
     * 检查主房间的能量存储是否已满
     * @param {Room} room - 房间对象
     * @returns {boolean} - 返回是否所有主要存储都已满
     */
    isMainRoomEnergyFull: function(room) {
        // 检查储存结构
        const storages = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE
        });
        
        if(storages.length > 0) {
            const storage = storages[0];
            // 如果存储器已超过90%容量，视为满
            if(storage.store.getUsedCapacity(RESOURCE_ENERGY) / storage.store.getCapacity(RESOURCE_ENERGY) > 0.9) {
                return true;
            }
        }
        
        // 检查容器
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        // 如果有容器并且都超过90%容量
        if(containers.length > 0) {
            let allFull = true;
            for(const container of containers) {
                if(container.store.getUsedCapacity(RESOURCE_ENERGY) / container.store.getCapacity(RESOURCE_ENERGY) < 0.9) {
                    allFull = false;
                    break;
                }
            }
            if(allFull) return true;
        }
        
        // 检查生产结构
        const spawns = room.find(FIND_MY_SPAWNS);
        const extensions = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        });
        
        let spawnsFull = true;
        let extensionsFull = true;
        
        // 检查spawn是否都满
        for(const spawn of spawns) {
            if(spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                spawnsFull = false;
                break;
            }
        }
        
        // 检查extension是否都满
        for(const extension of extensions) {
            if(extension.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                extensionsFull = false;
                break;
            }
        }
        
        // 当生产结构和存储结构都满时，返回true
        return spawnsFull && extensionsFull && 
               (storages.length > 0 || containers.length > 0);
    },
    
    /**
     * 创建远程运输者任务请求
     * @param {string} sourceRoomName - 源房间名称
     * @param {string} targetRoomName - 目标房间名称
     */
    createRemoteHaulerTask: function(sourceRoomName, targetRoomName) {
        // 确保有生成队列
        if(!Memory.spawnQueue) {
            Memory.spawnQueue = {};
        }
        
        if(!Memory.spawnQueue[sourceRoomName]) {
            Memory.spawnQueue[sourceRoomName] = [];
        }
        
        // 添加到生成队列
        Memory.spawnQueue[sourceRoomName].push({
            role: 'remoteHauler',
            priority: 4, // 中等优先级
            memory: {
                role: 'remoteHauler',
                homeRoom: sourceRoomName,
                targetRoom: targetRoomName,
                working: false,
                waiting: false
            }
        });
        
        console.log(`已添加远程运输者任务: 从 ${sourceRoomName} 派出远程运输者至 ${targetRoomName}`);
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        
        // 如果是用于storage hauler的特殊配置
        if(gameStage.level >= 6 && energy >= 1500) {
            // 高级阶段配置，大量CARRY和足够的MOVE
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else if(gameStage.level >= 4 && energy >= 1000) {
            // 中级阶段强化配置
            body = [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }
        else if(gameStage.level >= 3 && energy >= 600) {
            // 中级阶段配置
            body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                   MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }
        else if(energy >= 400) {
            // 基础配置
            body = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        }
        else {
            // 最小配置
            body = [CARRY, CARRY, MOVE, MOVE];
        }
        
        return body;
    }
};

module.exports = roleRemoteHauler; 