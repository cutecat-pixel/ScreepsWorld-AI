/**
 * 矿工角色模块
 * 专门负责从能量源采集能量并放入附近的容器
 */
const roleMiner = {
    /**
     * Miner的主要运行逻辑
     * @param {Creep} creep - 要控制的creep对象
     */
    run: function(creep) {
        // 如果没有分配目标源，查找并分配一个
        if(!creep.memory.sourceId) {
            this.assignSource(creep);
        }
        
        // 获取分配的能量源
        const source = Game.getObjectById(creep.memory.sourceId);
        if(!source) {
            // 如果能量源不存在，重新分配
            this.assignSource(creep);
            return;
        }
        
        // 查找源点附近的容器
        const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        // 查找源点附近的LINK
        const links = source.pos.findInRange(FIND_MY_STRUCTURES, 2, {
            filter: s => s.structureType === STRUCTURE_LINK
        });
        
        // 检查源点是否冷却或没有能量
        const sourceEmpty = source.energy === 0;
        
        // 如果源点冷却/没能量，且矿工有CARRY部件，检查容器能量
        if(sourceEmpty && creep.getActiveBodyparts(CARRY) > 0 && containers.length > 0 && links.length > 0) {
            const container = containers[0];
            
            // 如果容器有能量且矿工没满
            if(container.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && creep.store.getFreeCapacity() > 0) {
                // 移动到容器并从中拾取能量
                if(!creep.pos.isEqualTo(container.pos)) {
                    creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
                } else {
                    creep.withdraw(container, RESOURCE_ENERGY);
                }
            }
            // 如果矿工背包有能量，将能量传输到LINK
            else if(creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if(creep.transfer(links[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(links[0], {visualizePathStyle: {stroke: '#ffaa00'}});
                }
            }
            return;
        }
        
        // 检查是否有CARRY部件且能量已满
        if(creep.getActiveBodyparts(CARRY) > 0 && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            // 如果有LINK，优先传输到LINK
            if(links.length > 0) {
                if(creep.transfer(links[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(links[0], {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            } else if(containers.length > 0) {
                // 如果没有LINK，传输到容器
                if(creep.transfer(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(containers[0], {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                return;
            } else {
                // 如果既没有LINK也没有容器，扔到地上
                creep.drop(RESOURCE_ENERGY);
            }
        }
        
        // 如果附近有容器
        if(containers.length > 0) {
            const container = containers[0];
            
            // 如果矿工不在容器上，移动到容器上
            if(!creep.pos.isEqualTo(container.pos)) {
                creep.moveTo(container, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            // 已经站在容器上了，开始采集
            else {
                creep.harvest(source);
            }
        }
        // 如果附近没有容器，直接移动到源点旁边采集
        else {
            // 寻找源点附近的建筑工地（可能是正在建造的容器）
            const constructionSites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            });
            
            // 如果有容器的建筑工地
            if(constructionSites.length > 0) {
                const site = constructionSites[0];
                // 移动到工地上
                if(!creep.pos.isEqualTo(site.pos)) {
                    creep.moveTo(site, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                // 站在工地上后，采集源点并尝试建造容器
                else {
                    creep.harvest(source);
                    creep.build(site);
                }
            }
            // 如果连工地都没有，直接移动到源点附近
            else {
                // 找到源点附近的空位
                const positions = this.findAdjacentPositions(source.pos);
                if(positions.length > 0) {
                    // 如果不在目标位置，移动过去
                    if(!creep.pos.isEqualTo(positions[0])) {
                        creep.moveTo(positions[0], {visualizePathStyle: {stroke: '#ffaa00'}});
                    }
                    // 在目标位置后采集
                    else {
                        creep.harvest(source);
                        // 如果背包满了，在当前位置自动放置一个容器工地
                        if(creep.store.getFreeCapacity() === 0) {
                            creep.room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER);
                        }
                    }
                }
            }
        }
    },
    
    /**
     * 为矿工分配一个能量源
     * @param {Creep} creep - 要分配能量源的矿工
     */
    assignSource: function(creep) {
        // 获取房间中的所有能量源
        const sources = creep.room.find(FIND_SOURCES);
        if(sources.length === 0) return;
        
        // 获取当前房间中所有矿工
        const miners = _.filter(Game.creeps, c => 
            c.memory.role === 'miner' && 
            c.room.name === creep.room.name &&
            c.id !== creep.id &&
            c.memory.sourceId
        );
        
        // 用字典记录每个能量源已分配的矿工数量
        const sourceMiners = {};
        // 记录每个能量源可容纳的最大矿工数量（基于周围可用空间）
        const sourceCapacity = {};
        
        // 初始化每个能量源的矿工数量和容量
        sources.forEach(source => {
            sourceMiners[source.id] = 0;
            // 计算每个能量源周围可通行位置的数量作为容量
            // 这里传入所有矿工位置，确保已被占用的位置不被计算
            const adjacentPositions = this.findAdjacentPositions(source.pos);
            sourceCapacity[source.id] = Math.max(1, adjacentPositions.length); // 至少允许1个矿工
        });
        
        // 统计每个能量源的矿工数量
        miners.forEach(miner => {
            if(sourceMiners[miner.memory.sourceId] !== undefined) {
                sourceMiners[miner.memory.sourceId]++;
            }
        });
        
        // 找出矿工未达到容量上限且占比最低的能量源
        let targetSource = null;
        let lowestOccupancyRate = Infinity;
        
        for(const sourceId in sourceMiners) {
            // 计算占用率（当前矿工数/最大容量）
            const occupancyRate = sourceMiners[sourceId] / sourceCapacity[sourceId];
            
            // 只考虑未达到容量上限的能量源
            if(sourceMiners[sourceId] < sourceCapacity[sourceId] && occupancyRate < lowestOccupancyRate) {
                lowestOccupancyRate = occupancyRate;
                targetSource = sourceId;
            }
        }
        
        // 分配找到的能量源
        if(targetSource) {
            creep.memory.sourceId = targetSource;
            creep.say('⛏️ 分配源');
        } else {
            // 如果所有能量源都已达到容量上限，选择矿工最少的能量源
            let minMiners = Infinity;
            for(const sourceId in sourceMiners) {
                if(sourceMiners[sourceId] < minMiners) {
                    minMiners = sourceMiners[sourceId];
                    targetSource = sourceId;
                }
            }
            if(targetSource) {
                creep.memory.sourceId = targetSource;
                creep.say('⛏️ 共享源');
            }
        }
    },
    
    /**
     * 查找能量源周围的可通行位置
     * @param {RoomPosition} pos - 能量源的位置
     * @returns {Array} - 可通行位置数组
     */
    findAdjacentPositions: function(pos) {
        const positions = [];
        const room = Game.rooms[pos.roomName];
        
        // 获取房间内的所有矿工位置
        const minerPositions = [];
        _.filter(Game.creeps, c => c.memory.role === 'miner' && c.room.name === pos.roomName)
            .forEach(miner => {
                minerPositions.push({x: miner.pos.x, y: miner.pos.y});
            });
        
        // 检查源点周围8个位置
        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                if(dx === 0 && dy === 0) continue; // 跳过源点本身
                
                const x = pos.x + dx;
                const y = pos.y + dy;
                
                // 确保位置在房间边界内
                if(x < 0 || y < 0 || x > 49 || y > 49) continue;
                
                // 检查地形是否可通行
                const terrain = room.getTerrain();
                if(terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    // 检查该位置的结构
                    const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                    const constructionSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
                    
                    // 检查该位置是否有矿工
                    const hasMiner = minerPositions.some(p => p.x === x && p.y === y);
                    
                    if(structures.length === 0 && constructionSites.length === 0 && !hasMiner) {
                        positions.push(new RoomPosition(x, y, pos.roomName));
                    }
                }
            }
        }

        return positions;
    },
    
    /**
     * 根据游戏阶段和可用能量返回适合的身体部件
     * @param {number} energy - 可用能量
     * @param {Object} gameStage - 游戏阶段对象
     * @returns {Array} - 身体部件数组
     */
    getBody: function(energy, gameStage) {
        let body = [];
        if (gameStage.level >=6 && energy >= 900) {
            body = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]
        }
        // 矿工主要需要WORK部件和少量MOVE部件
        else if(gameStage.level >= 4 && energy >= 700) {
            // 高级阶段配置，大量WORK部件
            body = [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE];
        }
        else if(gameStage.level >= 3 && energy >= 500) {
            // 中级阶段配置
            body = [WORK, WORK, WORK, WORK, MOVE];
        }
        else if(energy >= 250) {
            // 基础配置
            body = [WORK, WORK, MOVE];
        }
        else {
            // 最小配置
            body = [WORK, MOVE];
        }
        
        return body;
    }
};

module.exports = roleMiner; 