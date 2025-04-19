/**
 * PowerCreep管理器
 * 负责管理和控制PowerCreep的行为
 */

const POWER_PRIORITIES = {
    // 操作Room Controller能力的优先级
    [PWR_OPERATE_CONTROLLER]: 1,
    // 操作Spawn能力的优先级
    [PWR_OPERATE_SPAWN]: 2,
    // 操作Extension能力的优先级
    [PWR_OPERATE_EXTENSION]: 3,
    // 操作Tower能力的优先级
    [PWR_OPERATE_TOWER]: 4,
    // 操作Storage能力的优先级
    [PWR_OPERATE_STORAGE]: 5,
    // 操作Factory能力的优先级
    [PWR_OPERATE_FACTORY]: 6,
    // 操作Terminal能力的优先级
    [PWR_OPERATE_TERMINAL]: 7,
    // 操作Lab能力的优先级
    [PWR_OPERATE_LAB]: 8,
    // 操作Observer能力的优先级
    [PWR_OPERATE_OBSERVER]: 9,
    // 生成资源能力的优先级
    [PWR_GENERATE_OPS]: 10,
};

// 超能creep寿命阈值，低于此值时会尝试恢复寿命
const RENEW_THRESHOLD = 200;

const powerCreepManager = {
    /**
     * 运行PowerCreep逻辑
     * 主循环调用此函数来管理所有PowerCreep
     */
    run: function() {
        // 遍历所有PowerCreep
        for(const name in Game.powerCreeps) {
            const powerCreep = Game.powerCreeps[name];
            
            // 如果PowerCreep未被生成或已经死亡，尝试重生
            if(!powerCreep.ticksToLive) {
                this.respawnPowerCreep(powerCreep);
                continue;
            }
            
            // 处理活跃的PowerCreep
            this.runPowerCreep(powerCreep);
        }
        
        // 每100tick检查一次是否需要创建新的PowerCreep
        if(Game.time % 100 === 0) {
            this.checkAndCreatePowerCreeps();
        }
    },
    
    /**
     * 检查并创建新的PowerCreep
     */
    checkAndCreatePowerCreeps: function() {
        // 如果玩家没有足够的Power等级，返回
        if(Game.gpl.level <= Object.keys(Game.powerCreeps).length) {
            return;
        }
        
        // 获取可以创建的PowerCreep类型
        const availableClass = this.getOptimalPowerCreepClass();
        
        // 创建新的PowerCreep
        if(availableClass) {
            const newName = `${availableClass}${Game.time}`;
            PowerCreep.create(newName, availableClass);
            console.log(`创建了新的PowerCreep: ${newName}, 职业: ${availableClass}`);
        }
    },
    
    /**
     * 获取最优的PowerCreep职业
     * @returns {string} 最优职业名
     */
    getOptimalPowerCreepClass: function() {
        // 统计现有各职业PowerCreep数量
        const classCounts = {
            'operator': 0,
            'executor': 0,
            'engineer': 0
        };
        
        for(const name in Game.powerCreeps) {
            const powerCreep = Game.powerCreeps[name];
            classCounts[powerCreep.className]++;
        }
        
        // 根据游戏需求返回最合适的职业
        // 优先考虑Operator，因为它的能力对基础设施改进最明显
        if(classCounts['operator'] === 0) {
            return 'operator';
        }
        // 其次是Executor，它的能力能提高战斗力
        else if(classCounts['executor'] === 0) {
            return 'executor';
        }
        // 最后是Engineer，它适合支持角色
        else if(classCounts['engineer'] === 0) {
            return 'engineer';
        }
        // 如果每个职业都有了，平衡发展
        else {
            // 找出数量最少的职业
            let minClass = 'operator';
            let minCount = classCounts['operator'];
            
            for(const className in classCounts) {
                if(classCounts[className] < minCount) {
                    minCount = classCounts[className];
                    minClass = className;
                }
            }
            
            return minClass;
        }
    },
    
    /**
     * 尝试在指定房间重生PowerCreep
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    respawnPowerCreep: function(powerCreep) {
        // 如果PowerCreep没有指定的房间，设置一个默认房间
        if(!powerCreep.memory.homeRoom) {
            this.assignHomeRoom(powerCreep);
        }
        
        // 尝试重生
        const homeRoom = powerCreep.memory.homeRoom;
        if(homeRoom && Game.rooms[homeRoom] && Game.rooms[homeRoom].controller && Game.rooms[homeRoom].controller.my) {
            // 检查是否有Power Spawn
            const powerSpawn = Game.rooms[homeRoom].find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_POWER_SPAWN
            })[0];
            
            if(powerSpawn) {
                const result = powerCreep.spawn(powerSpawn);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 在 ${homeRoom} 重生成功`);
                } else if(result === ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`PowerCreep ${powerCreep.name} 无法重生：Power Spawn 能量不足`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 重生失败，错误码: ${result}`);
                }
            } else {
                console.log(`PowerCreep ${powerCreep.name} 无法重生：${homeRoom} 没有Power Spawn`);
            }
        } else {
            console.log(`PowerCreep ${powerCreep.name} 无法重生：没有有效的家乡房间`);
        }
    },
    
    /**
     * 为PowerCreep分配一个家乡房间
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    assignHomeRoom: function(powerCreep) {
        // 寻找有Power Spawn的房间
        for(const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if(room.controller && room.controller.my && room.controller.level >= 8) {
                const powerSpawn = room.find(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_POWER_SPAWN
                })[0];
                
                if(powerSpawn) {
                    powerCreep.memory.homeRoom = roomName;
                    console.log(`PowerCreep ${powerCreep.name} 被分配到房间 ${roomName}`);
                    return;
                }
            }
        }
        
        // 如果没找到有Power Spawn的房间，分配到任意一个等级8的房间
        for(const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if(room.controller && room.controller.my && room.controller.level >= 8) {
                powerCreep.memory.homeRoom = roomName;
                console.log(`PowerCreep ${powerCreep.name} 被分配到房间 ${roomName} (无Power Spawn)`);
                return;
            }
        }
        
        // 如果没有等级8的房间，分配到任意一个有控制器的房间
        for(const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if(room.controller && room.controller.my) {
                powerCreep.memory.homeRoom = roomName;
                console.log(`PowerCreep ${powerCreep.name} 被分配到房间 ${roomName} (低等级房间)`);
                return;
            }
        }
    },
    
    /**
     * 运行单个PowerCreep的逻辑
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runPowerCreep: function(powerCreep) {
        // 初始化内存
        if(!powerCreep.memory) powerCreep.memory = {};
        if(!powerCreep.memory.working) powerCreep.memory.working = false;
        
        // 如果PowerCreep不在其家乡房间，移动过去
        if(powerCreep.room.name !== powerCreep.memory.homeRoom) {
            const targetRoom = Game.rooms[powerCreep.memory.homeRoom];
            if(targetRoom) {
                // 移动到房间中心
                powerCreep.moveTo(new RoomPosition(25, 25, powerCreep.memory.homeRoom), {
                    visualizePathStyle: {stroke: '#a9d1ff'}
                });
            }
            return;
        }
        
        // 检查是否需要恢复寿命
        if(powerCreep.ticksToLive < RENEW_THRESHOLD) {
            if(this.renewPowerCreep(powerCreep)) {
                return;
            }
        }
        
        // 检查是否需要将Power放回Storage
        if(powerCreep.memory.storePower && powerCreep.store[RESOURCE_POWER] > 0) {
            if(this.storePowerToStorage(powerCreep)) {
                return;
            }
        }
        
        // 检查是否携带了Power资源需要送到PowerSpawn
        // 只有在明确设置了deliverPower标志时才会尝试运送Power到PowerSpawn
        if(powerCreep.memory.deliverPower && powerCreep.store[RESOURCE_POWER] > 0) {
            if(this.deliverPowerToPowerSpawn(powerCreep)) {
                return;
            }
        }
        
        // 检查是否需要从Storage获取Power
        if(powerCreep.memory.needPower) {
            if(this.collectPowerFromStorage(powerCreep)) {
                return;
            }
        }
        
        // 检查是否需要启用能力
        if(powerCreep.powers && !powerCreep.memory.working) {
            // 如果OPS不足，先生成OPS
            if(powerCreep.store[RESOURCE_OPS] < 100) {
                this.runGenerateOps(powerCreep);
                return;
            }
            
            // 按优先级获取最高的可用能力
            const powerToUse = this.getHighestPriorityPower(powerCreep);
            if(powerToUse) {
                this.usePower(powerCreep, powerToUse);
                return;
            }
        }
        
        // 如果没有事情做，移动到指定位置待命
        this.moveToIdlePosition(powerCreep);
    },
    
    /**
     * 获取当前PowerCreep优先级最高的可用能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     * @returns {string|null} 能力代码或null
     */
    getHighestPriorityPower: function(powerCreep) {
        // 创建按优先级排序的能力数组
        const powersWithPriority = [];
        
        // 遍历所有可用的能力
        for(const power in powerCreep.powers) {
            // 检查能力是否已冷却
            if(powerCreep.powers[power].cooldown === 0) {
                powersWithPriority.push({
                    power: power,
                    priority: POWER_PRIORITIES[power] || 999
                });
            }
        }
        
        // 按优先级排序
        powersWithPriority.sort((a, b) => a.priority - b.priority);
        
        // 返回优先级最高的能力，如果没有则返回null
        return powersWithPriority.length > 0 ? powersWithPriority[0].power : null;
    },
    
    /**
     * 使用指定的能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     * @param {string} power - 能力代码
     */
    usePower: function(powerCreep, power) {
        powerCreep.memory.working = true;
        
        switch(power) {
            case PWR_GENERATE_OPS:
                this.runGenerateOps(powerCreep);
                break;
                
            case PWR_OPERATE_SPAWN:
                this.runOperateSpawn(powerCreep);
                break;
                
            case PWR_OPERATE_EXTENSION:
                this.runOperateExtension(powerCreep);
                break;
                
            case PWR_OPERATE_TOWER:
                this.runOperateTower(powerCreep);
                break;
                
            case PWR_OPERATE_STORAGE:
                this.runOperateStorage(powerCreep);
                break;
                
            case PWR_OPERATE_CONTROLLER:
                this.runOperateController(powerCreep);
                break;
                
            case PWR_OPERATE_FACTORY:
                this.runOperateFactory(powerCreep);
                break;
                
            case PWR_OPERATE_TERMINAL:
                this.runOperateTerminal(powerCreep);
                break;
                
            case PWR_OPERATE_LAB:
                this.runOperateLab(powerCreep);
                break;
                
            case PWR_OPERATE_OBSERVER:
                this.runOperateObserver(powerCreep);
                break;
                
            default:
                // 未知能力
                powerCreep.memory.working = false;
        }
    },
    
    /**
     * 生成OPS资源
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runGenerateOps: function(powerCreep) {
        // 检查是否有生成OPS的能力
        if(!powerCreep.powers[PWR_GENERATE_OPS]) {
            return;
        }
        
        // 执行生成OPS的操作
        if(powerCreep.store.getFreeCapacity() > 0) {
            powerCreep.usePower(PWR_GENERATE_OPS);
            powerCreep.memory.working = false;
        }
    },
    
    /**
     * 使用PWR_OPERATE_SPAWN能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateSpawn: function(powerCreep) {
        // 找到房间中所有spawn
        const spawns = powerCreep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_SPAWN
        });
        
        // 优先选择正在生产的spawn
        let targetSpawn = null;
        for(const spawn of spawns) {
            if(spawn.spawning) {
                targetSpawn = spawn;
                break;
            }
        }
        
        // 如果没有正在生产的，选第一个
        if(!targetSpawn && spawns.length > 0) {
            targetSpawn = spawns[0];
        }
        
        if(targetSpawn) {
            // 检查是否已经有效果
            if(!targetSpawn.effects || !targetSpawn.effects.find(e => e.effect === PWR_OPERATE_SPAWN)) {
                // 移动到目标并使用能力
                if(powerCreep.pos.isNearTo(targetSpawn)) {
                    const result = powerCreep.usePower(PWR_OPERATE_SPAWN, targetSpawn);
                    if(result === OK) {
                        console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_SPAWN 在 ${targetSpawn.name}`);
                    } else {
                        console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_SPAWN 失败，错误码: ${result}`);
                    }
                } else {
                    powerCreep.moveTo(targetSpawn, {
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
                return;
            }
        }
        
        // 如果没有找到合适的目标或目标已经有效果，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_EXTENSION能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateExtension: function(powerCreep) {
        // 只有在房间能量不足50%时才使用此能力
        const energyFillPercentage = powerCreep.room.energyAvailable / powerCreep.room.energyCapacityAvailable;
        
        if(energyFillPercentage < 0.5) {
            // 从最近的一个extension开始
            const extension = powerCreep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            });
            
            if(extension) {
                // 移动到目标并使用能力
                if(powerCreep.pos.isNearTo(extension)) {
                    const result = powerCreep.usePower(PWR_OPERATE_EXTENSION, extension);
                    if(result === OK) {
                        console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_EXTENSION`);
                    } else {
                        console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_EXTENSION 失败，错误码: ${result}`);
                    }
                } else {
                    powerCreep.moveTo(extension, {
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
                return;
            }
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_TOWER能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateTower: function(powerCreep) {
        // 只有在房间受到攻击时才使用
        if(Memory.roomData && Memory.roomData[powerCreep.room.name] && Memory.roomData[powerCreep.room.name].underAttack) {
            // 寻找没有效果的塔
            const towers = powerCreep.room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER && 
                        (!s.effects || !s.effects.find(e => e.effect === PWR_OPERATE_TOWER))
            });
            
            if(towers.length > 0) {
                const targetTower = towers[0];
                
                // 移动到目标并使用能力
                if(powerCreep.pos.isNearTo(targetTower)) {
                    const result = powerCreep.usePower(PWR_OPERATE_TOWER, targetTower);
                    if(result === OK) {
                        console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_TOWER`);
                    } else {
                        console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_TOWER 失败，错误码: ${result}`);
                    }
                } else {
                    powerCreep.moveTo(targetTower, {
                        visualizePathStyle: {stroke: '#ffaa00'}
                    });
                }
                return;
            }
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_STORAGE能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateStorage: function(powerCreep) {
        const storage = powerCreep.room.storage;
        
        if(storage && (!storage.effects || !storage.effects.find(e => e.effect === PWR_OPERATE_STORAGE))) {
            // 移动到目标并使用能力
            if(powerCreep.pos.isNearTo(storage)) {
                const result = powerCreep.usePower(PWR_OPERATE_STORAGE, storage);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_STORAGE`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_STORAGE 失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(storage, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            return;
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_CONTROLLER能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateController: function(powerCreep) {
        const controller = powerCreep.room.controller;
        
        if(controller && controller.my && (!controller.effects || !controller.effects.find(e => e.effect === PWR_OPERATE_CONTROLLER))) {
            // 移动到目标并使用能力
            if(powerCreep.pos.isNearTo(controller)) {
                const result = powerCreep.usePower(PWR_OPERATE_CONTROLLER, controller);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_CONTROLLER`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_CONTROLLER 失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(controller, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            return;
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 运行PWR_OPERATE_FACTORY能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateFactory: function(powerCreep) {
        const factory = powerCreep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_FACTORY
        })[0];
        
        if(factory && (!factory.effects || !factory.effects.find(e => e.effect === PWR_OPERATE_FACTORY))) {
            // 移动到目标并使用能力
            if(powerCreep.pos.isNearTo(factory)) {
                const result = powerCreep.usePower(PWR_OPERATE_FACTORY, factory);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_FACTORY`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_FACTORY 失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(factory, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            return;
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_TERMINAL能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateTerminal: function(powerCreep) {
        const terminal = powerCreep.room.terminal;
        
        // 只在有交易任务时使用
        if(terminal && (!terminal.effects || !terminal.effects.find(e => e.effect === PWR_OPERATE_TERMINAL)) && 
           powerCreep.room.memory && powerCreep.room.memory.terminalTasks && powerCreep.room.memory.terminalTasks.length > 0) {
            // 移动到目标并使用能力
            if(powerCreep.pos.isNearTo(terminal)) {
                const result = powerCreep.usePower(PWR_OPERATE_TERMINAL, terminal);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_TERMINAL`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_TERMINAL 失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(terminal, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            return;
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_LAB能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateLab: function(powerCreep) {
        // 找到正在反应的Lab
        const labs = powerCreep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB && 
                    (!s.effects || !s.effects.find(e => e.effect === PWR_OPERATE_LAB)) &&
                    s.mineralType // 有矿物的Lab可能正在进行反应
        });
        
        if(labs.length > 0) {
            const targetLab = labs[0];
            
            // 移动到目标并使用能力
            if(powerCreep.pos.isNearTo(targetLab)) {
                const result = powerCreep.usePower(PWR_OPERATE_LAB, targetLab);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_LAB`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_LAB 失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(targetLab, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            return;
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 使用PWR_OPERATE_OBSERVER能力
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    runOperateObserver: function(powerCreep) {
        const observer = powerCreep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_OBSERVER
        })[0];
        
        if(observer && (!observer.effects || !observer.effects.find(e => e.effect === PWR_OPERATE_OBSERVER))) {
            // 移动到目标并使用能力
            if(powerCreep.pos.isNearTo(observer)) {
                const result = powerCreep.usePower(PWR_OPERATE_OBSERVER, observer);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_OBSERVER`);
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 使用 PWR_OPERATE_OBSERVER 失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(observer, {
                    visualizePathStyle: {stroke: '#ffaa00'}
                });
            }
            return;
        }
        
        // 如果不需要使用此能力，标记为未工作
        powerCreep.memory.working = false;
    },
    
    /**
     * 尝试恢复PowerCreep的寿命
     * @param {PowerCreep} powerCreep - PowerCreep对象
     * @returns {boolean} 是否成功处理了恢复寿命的行为
     */
    renewPowerCreep: function(powerCreep) {
        // 寻找PowerSpawn或PowerBank
        let renewStructure = powerCreep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        });
        
        // 如果没有PowerSpawn，尝试寻找PowerBank
        if(!renewStructure) {
            renewStructure = powerCreep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_POWER_BANK
            });
        }
        
        if(renewStructure) {
            // 移动到目标并恢复寿命
            if(powerCreep.pos.isNearTo(renewStructure)) {
                const result = powerCreep.renew(renewStructure);
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 恢复寿命成功，当前寿命: ${powerCreep.ticksToLive}`);
                    return true;
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 恢复寿命失败，错误码: ${result}`);
                }
            } else {
                powerCreep.moveTo(renewStructure, {
                    visualizePathStyle: {stroke: '#ff88ff'},
                    range: 1
                });
                return true;
            }
        } else {
            console.log(`PowerCreep ${powerCreep.name} 寿命低，但找不到可以恢复寿命的建筑`);
        }
        
        return false;
    },
    
    /**
     * 移动到待命位置
     * @param {PowerCreep} powerCreep - PowerCreep对象
     */
    moveToIdlePosition: function(powerCreep) {
        // 优先待在PowerSpawn附近
        const powerSpawn = powerCreep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_SPAWN
        })[0];
        
        if(powerSpawn) {
            powerCreep.moveTo(powerSpawn, {
                visualizePathStyle: {stroke: '#ffffff'},
                range: 1
            });
            return;
        }
        
        // 否则待在Storage附近
        if(powerCreep.room.storage) {
            powerCreep.moveTo(powerCreep.room.storage, {
                visualizePathStyle: {stroke: '#ffffff'},
                range: 1
            });
            return;
        }
        
        // 最后选择待在Spawn附近
        const spawn = powerCreep.room.find(FIND_MY_SPAWNS)[0];
        if(spawn) {
            powerCreep.moveTo(spawn, {
                visualizePathStyle: {stroke: '#ffffff'},
                range: 2
            });
        }
    },
    
    /**
     * 从Storage中收集Power
     * @param {PowerCreep} powerCreep - PowerCreep对象
     * @returns {boolean} - 是否成功处理了收集Power的行为
     */
    collectPowerFromStorage: function(powerCreep) {
        // 检查是否有Storage
        const storage = powerCreep.room.storage;
        if(!storage || !storage.store[RESOURCE_POWER] || storage.store[RESOURCE_POWER] <= 0) {
            console.log(`PowerCreep ${powerCreep.name} 无法收集Power：Storage中没有Power`);
            powerCreep.memory.needPower = false; // 重置标志，避免持续尝试
            return false;
        }
        
        // 计算要收集多少Power（最多收集自身容量或存储中可用量）
        const amount = Math.min(400, storage.store[RESOURCE_POWER], powerCreep.store.getFreeCapacity());
        
        if(amount <= 0) {
            console.log(`PowerCreep ${powerCreep.name} 背包已满，无法收集更多Power`);
            powerCreep.memory.needPower = false;
            return false;
        }
        
        // 移动到Storage并收集Power
        if(powerCreep.pos.isNearTo(storage)) {
            const result = powerCreep.withdraw(storage, RESOURCE_POWER, amount);
            if(result === OK) {
                console.log(`PowerCreep ${powerCreep.name} 成功从Storage获取 ${amount} 单位的Power`);
                powerCreep.memory.needPower = false; // 重置标志
                powerCreep.say('🔋Power');
                return true;
            } else {
                console.log(`PowerCreep ${powerCreep.name} 获取Power失败，错误码: ${result}`);
                return false;
            }
        } else {
            powerCreep.moveTo(storage, {
                visualizePathStyle: {stroke: '#ffaa00'}
            });
            powerCreep.say('🔄→Power');
            return true;
        }
    },
    
    /**
     * 将Power放入Storage
     * @param {PowerCreep} powerCreep - PowerCreep对象
     * @returns {boolean} - 是否成功处理了将Power放入Storage的行为
     */
    storePowerToStorage: function(powerCreep) {
        // 检查是否有Storage
        const storage = powerCreep.room.storage;
        if(!storage) {
            console.log(`PowerCreep ${powerCreep.name} 无法存储Power：房间中没有Storage`);
            powerCreep.memory.storePower = false; // 重置标志，避免持续尝试
            return false;
        }
        
        // 检查PowerCreep是否有Power资源
        const powerAmount = powerCreep.store[RESOURCE_POWER];
        if(powerAmount <= 0) {
            console.log(`PowerCreep ${powerCreep.name} 背包中没有Power可以存储`);
            powerCreep.memory.storePower = false;
            return false;
        }
        
        // 移动到Storage并存储Power
        if(powerCreep.pos.isNearTo(storage)) {
            const result = powerCreep.transfer(storage, RESOURCE_POWER);
            if(result === OK) {
                console.log(`PowerCreep ${powerCreep.name} 成功将 ${powerAmount} 单位的Power存储到Storage`);
                powerCreep.memory.storePower = false; // 重置标志
                powerCreep.say('💾存Power');
                return true;
            } else {
                console.log(`PowerCreep ${powerCreep.name} 存储Power失败，错误码: ${result}`);
                return false;
            }
        } else {
            powerCreep.moveTo(storage, {
                visualizePathStyle: {stroke: '#ffaa00'}
            });
            powerCreep.say('→Storage');
            return true;
        }
    },
    
    /**
     * 将Power送到PowerSpawn
     * @param {PowerCreep} powerCreep - PowerCreep对象
     * @returns {boolean} - 是否成功处理了运送Power的行为
     */
    deliverPowerToPowerSpawn: function(powerCreep) {
        try {
            // 寻找PowerSpawn
            const powerSpawn = powerCreep.room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_POWER_SPAWN
            })[0];
            
            if(!powerSpawn) {
                console.log(`PowerCreep ${powerCreep.name} 无法运送Power：房间中没有PowerSpawn`);
                powerCreep.memory.deliverPower = false; // 重置标志
                return false;
            }
            
            // 检查PowerCreep是否有Power资源
            const powerAmount = powerCreep.store[RESOURCE_POWER];
            if(powerAmount <= 0) {
                console.log(`PowerCreep ${powerCreep.name} 背包中没有Power可以运送`);
                powerCreep.memory.deliverPower = false; // 重置标志
                return false;
            }
            
            // 检查PowerSpawn是否有足够的空间接收Power
            const powerSpawnFreeSpace = powerSpawn.store.getFreeCapacity(RESOURCE_POWER);
            if(powerSpawnFreeSpace <= 0) {
                console.log(`PowerCreep ${powerCreep.name} 无法运送Power：PowerSpawn已满`);
                powerCreep.memory.deliverPower = false; // 重置标志
                // 不再自动设置storePower标志
                return false;
            }
            
            // 移动到PowerSpawn并转移Power
            if(powerCreep.pos.isNearTo(powerSpawn)) {
                // 计算实际可以转移的数量
                const transferAmount = Math.min(powerAmount, powerSpawnFreeSpace);
                console.log(`尝试运送 ${transferAmount} 单位的Power到PowerSpawn`);
                
                const result = powerCreep.transfer(powerSpawn, RESOURCE_POWER);
                
                if(result === OK) {
                    console.log(`PowerCreep ${powerCreep.name} 成功向PowerSpawn运送 ${transferAmount} 单位的Power`);
                    powerCreep.memory.deliverPower = false; // 重置标志，任务完成
                    powerCreep.say('⚡送Power');
                    return true;
                } else {
                    console.log(`PowerCreep ${powerCreep.name} 运送Power失败，错误码: ${result}`);
                    
                    // 详细记录错误原因
                    switch(result) {
                        case ERR_NOT_OWNER:
                            console.log("错误：不是PowerSpawn的所有者");
                            break;
                        case ERR_BUSY:
                            console.log("错误：PowerCreep正忙");
                            break;
                        case ERR_NOT_ENOUGH_RESOURCES:
                            console.log("错误：PowerCreep没有足够的资源");
                            powerCreep.memory.deliverPower = false; // 重置标志
                            break;
                        case ERR_INVALID_TARGET:
                            console.log("错误：PowerSpawn不是有效的目标");
                            powerCreep.memory.deliverPower = false; // 重置标志
                            break;
                        case ERR_FULL:
                            console.log("错误：PowerSpawn已满");
                            // 只重置deliverPower标志，不设置storePower标志
                            powerCreep.memory.deliverPower = false;
                            break;
                        case ERR_NOT_IN_RANGE:
                            console.log("错误：PowerCreep不在PowerSpawn附近");
                            break;
                        case ERR_INVALID_ARGS:
                            console.log("错误：参数无效，尝试不指定数量");
                            break;
                        default:
                            console.log(`未知错误: ${result}`);
                    }
                    
                    return false;
                }
            } else {
                powerCreep.moveTo(powerSpawn, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 5
                });
                powerCreep.say('⚡→PowerSpawn');
                return true;
            }
        } catch(error) {
            console.log(`PowerCreep运送Power过程中发生异常: ${error.stack || error}`);
            powerCreep.memory.deliverPower = false; // 发生异常时重置标志
            return false;
        }
    }
};

module.exports = powerCreepManager; 