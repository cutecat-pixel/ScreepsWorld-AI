/**
 * PowerSpawn管理器
 * 负责管理和控制PowerSpawn的行为
 */

const powerSpawnManager = {
    /**
     * 运行PowerSpawn逻辑
     * 主循环调用此函数来管理所有PowerSpawn
     */
    run: function() {
        // 遍历所有房间，处理每个房间中的PowerSpawn
        for(const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            // 只处理我控制的房间
            if(room.controller && room.controller.my) {
                this.managePowerSpawnInRoom(room);
            }
        }
    },
    
    /**
     * 管理房间中的PowerSpawn
     * @param {Room} room - 房间对象
     */
    managePowerSpawnInRoom: function(room) {
        // 获取房间中的PowerSpawn
        const powerSpawn = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        // 如果没有PowerSpawn，直接返回
        if(!powerSpawn) return;
        
        // 初始化房间内存
        if(!room.memory.powerManagement) {
            room.memory.powerManagement = {
                processPower: true,  // 默认启用能量处理
                minEnergyLevel: 10000, // 最小能量水平，低于此值不处理Power
                minPowerLevel: 1     // 最小Power数量，低于此值不处理
            };
        }
        
        // 获取房间的Power管理配置
        const config = room.memory.powerManagement;
        
        // 检查是否需要处理Power
        if(config.processPower) {
            this.processPoWeR(powerSpawn, room, config);
        }

        // 检查是否需要创建PowerHauler
        this.createPowerHauler(room);
    },
    
    /**
     * 处理Power能量
     * @param {StructurePowerSpawn} powerSpawn - PowerSpawn结构
     * @param {Room} room - 房间对象
     * @param {Object} config - Power管理配置
     */
    processPoWeR: function(powerSpawn, room, config) {
        // 检查是否有足够的能量和Power
        const energyAvailable = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0;
        
        // 如果能量不足，不处理Power
        if(energyAvailable < config.minEnergyLevel) {
            return;
        }
        
        // 检查PowerSpawn的能量和Power水平
        const powerSpawnEnergy = powerSpawn.store[RESOURCE_ENERGY];
        const powerSpawnPower = powerSpawn.store[RESOURCE_POWER];
        
        // 如果PowerSpawn能量不足，从Storage转移能量
        if(powerSpawnEnergy < 2000) {
            this.transferResourceToPowerSpawn(room, powerSpawn, RESOURCE_ENERGY);
        }
        
        // 如果PowerSpawn的Power不足，从Storage转移Power
        if(powerSpawnPower < 10) {
            this.transferResourceToPowerSpawn(room, powerSpawn, RESOURCE_POWER);
        }
        
        // 如果PowerSpawn有足够的能量和Power，处理Power
        if(powerSpawnEnergy >= POWER_SPAWN_ENERGY_RATIO && powerSpawnPower >= 1) {
            powerSpawn.processPower();
        }
    },
    
    /**
     * 从Storage向PowerSpawn转移资源
     * @param {Room} room - 房间对象
     * @param {StructurePowerSpawn} powerSpawn - PowerSpawn结构
     * @param {string} resourceType - 资源类型
     */
    transferResourceToPowerSpawn: function(room, powerSpawn, resourceType) {
        // 检查是否有Storage
        if(!room.storage) {
            return;
        }
        
        // 检查Storage中是否有足够的资源
        const resourceAvailable = room.storage.store[resourceType] || 0;
        const minAmount = resourceType === RESOURCE_ENERGY ? 5000 : 10;
        
        if(resourceAvailable < minAmount) {
            return;
        }
        
        // 创建任务
        if(!room.memory.powerSpawnTransferTasks) {
            room.memory.powerSpawnTransferTasks = [];
        }
        
        // 检查是否已有相同类型的任务
        const existingTask = room.memory.powerSpawnTransferTasks.find(
            task => task.resource === resourceType
        );
        
        if(!existingTask) {
            // 创建新任务
            const amount = resourceType === RESOURCE_ENERGY ? 1000 : 100;
            
            room.memory.powerSpawnTransferTasks.push({
                id: `powerSpawn_${resourceType}_${Game.time}`,
                type: 'transfer',
                resource: resourceType,
                amount: Math.min(amount, resourceAvailable),
                from: 'storage',
                to: 'powerSpawn',
                priority: resourceType === RESOURCE_ENERGY ? 2 : 1 // 能量优先级低一些
            });
        }
    },
    
    /**
     * 创建Power运输者角色
     * @param {Room} room - 房间对象
     */
    createPowerHauler: function(room) {
        // 检查是否有足够的Power待处理
        let needPowerHauler = false;
        
        if(room.storage && room.storage.store[RESOURCE_POWER] > 100) {
            const powerSpawn = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_POWER_SPAWN
            })[0];
            
            if(powerSpawn && powerSpawn.store[RESOURCE_POWER] < 10) {
                needPowerHauler = true;
            }
        }
        
        // 如果需要Power运输者且没有正在生产，添加到生成队列
        if(needPowerHauler) {
            // 检查现有的Power运输者
            const existingHaulers = _.filter(Game.creeps, creep => 
                creep.memory.role === 'powerHauler' && 
                creep.memory.homeRoom === room.name
            );
            
            // 如果已经有专门的Power运输者，不再创建
            if(existingHaulers.length > 0) {
                return;
            }
            
            // 创建生成队列
            if(!Memory.spawnQueue) {
                Memory.spawnQueue = {};
            }
            
            if(!Memory.spawnQueue[room.name]) {
                Memory.spawnQueue[room.name] = [];
            }
            
            // 添加到生成队列
            Memory.spawnQueue[room.name].push({
                role: 'powerHauler',
                priority: 2, // 中等优先级
                memory: {
                    role: 'powerHauler',
                    homeRoom: room.name
                }
            });
            
            console.log(`${room.name} 添加Power运输者到生成队列`);
        }
    },
    
    /**
     * 全局函数：启用/禁用Power处理
     * @param {string} roomName - 房间名称
     * @param {boolean} enable - 是否启用Power处理
     * @returns {string} - 操作结果信息
     */
    togglePowerProcessing: function(roomName, enable = true) {
        const room = Game.rooms[roomName];
        
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        // 检查房间是否有PowerSpawn
        const powerSpawn = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        if(!powerSpawn) {
            return `错误：房间 ${roomName} 没有PowerSpawn`;
        }
        
        // 初始化内存
        if(!room.memory.powerManagement) {
            room.memory.powerManagement = {
                processPower: enable,
                minEnergyLevel: 10000,
                minPowerLevel: 1
            };
        } else {
            room.memory.powerManagement.processPower = enable;
        }
        
        return `房间 ${roomName} 的Power处理已${enable ? '启用' : '禁用'}`;
    },
    
    /**
     * 全局函数：设置Power处理的最小能量水平
     * @param {string} roomName - 房间名称
     * @param {number} level - 最小能量水平
     * @returns {string} - 操作结果信息
     */
    setMinEnergyLevel: function(roomName, level) {
        const room = Game.rooms[roomName];
        
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        // 检查房间是否有PowerSpawn
        const powerSpawn = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        if(!powerSpawn) {
            return `错误：房间 ${roomName} 没有PowerSpawn`;
        }
        
        // 初始化内存
        if(!room.memory.powerManagement) {
            room.memory.powerManagement = {
                processPower: true,
                minEnergyLevel: level,
                minPowerLevel: 1
            };
        } else {
            room.memory.powerManagement.minEnergyLevel = level;
        }
        
        return `房间 ${roomName} 的Power处理最小能量水平已设置为 ${level}`;
    }
};

module.exports = powerSpawnManager; 