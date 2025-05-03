/**
 * 改进版Lab管理器模块
 * 支持灵活配置、直接反应、高效资源管理和直观用户界面
 */
const LAB_TASK_TYPE_LOAD = 'load';
const LAB_TASK_TYPE_UNLOAD = 'unload';

// 反应配方数据库
const REACTION_RECIPES = {
    // 基础反应
    [RESOURCE_HYDROXIDE]: {
        components: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN],
        level: 0 // 基础等级
    },
    [RESOURCE_ZYNTHIUM_KEANITE]: {
        components: [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM],
        level: 0
    },
    // 第1级化合物
    [RESOURCE_UTRIUM_LEMERGITE]: {
        components: [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM],
        level: 1
    },
    [RESOURCE_GHODIUM_ALKALIDE]: {
        components: [RESOURCE_GHODIUM, RESOURCE_HYDROXIDE],
        level: 1
    },
    // 升级链（以XKHO2为例）
    [RESOURCE_KEANIUM_OXIDE]: { // KO
        components: [RESOURCE_KEANIUM, RESOURCE_OXYGEN],
        level: 1
    },
    [RESOURCE_KEANIUM_ALKALIDE]: { // KHO2
        components: [RESOURCE_KEANIUM_OXIDE, RESOURCE_HYDROXIDE],
        level: 2
    },
    [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: { // XKHO2
        components: [RESOURCE_KEANIUM_ALKALIDE, RESOURCE_CATALYST],
        level: 3
    },
    // 防御型Boost化合物
    [RESOURCE_UTRIUM_HYDRIDE]: { // UH - 提高攻击力400%
        components: [RESOURCE_UTRIUM, RESOURCE_HYDROGEN],
        level: 1
    },
    [RESOURCE_UTRIUM_ACID]: { // UHO2 - 提高攻击力200%
        components: [RESOURCE_UTRIUM_OXIDE, RESOURCE_HYDROXIDE],
        level: 2
    },
    [RESOURCE_CATALYZED_UTRIUM_ACID]: { // XUH2O - 提高攻击力700%
        components: [RESOURCE_UTRIUM_ACID, RESOURCE_CATALYST],
        level: 3
    },
    [RESOURCE_GHODIUM_OXIDE]: { // GO - 减少伤害50%
        components: [RESOURCE_GHODIUM, RESOURCE_OXYGEN],
        level: 1
    },
    [RESOURCE_GHODIUM_ALKALIDE]: { // GHO2 - 减少伤害30%
        components: [RESOURCE_GHODIUM_OXIDE, RESOURCE_HYDROXIDE],
        level: 2
    },
    [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: { // XGHO2 - 减少伤害70%
        components: [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYST],
        level: 3
    },
    [RESOURCE_LEMERGIUM_OXIDE]: { // LO - 提高治疗力400%
        components: [RESOURCE_LEMERGIUM, RESOURCE_OXYGEN],
        level: 1
    },
    [RESOURCE_LEMERGIUM_ALKALIDE]: { // LHO2 - 提高治疗力200%
        components: [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_HYDROXIDE],
        level: 2
    },
    [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: { // XLHO2 - 提高治疗力700%
        components: [RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_CATALYST],
        level: 3
    }
    // ... 可以继续添加更多配方
};

// Boost化合物分类
const BOOST_COMPOUNDS = {
    [ATTACK]: [
        RESOURCE_CATALYZED_UTRIUM_ACID,    // UH2O - 提高攻击力700%
        RESOURCE_UTRIUM_HYDRIDE,           // UH - 提高攻击力400%
        RESOURCE_UTRIUM_ACID               // UHO2 - 提高攻击力200%
    ],
    [RANGED_ATTACK]: [
        RESOURCE_CATALYZED_KEANIUM_ALKALIDE, // XKHO2 - 提高远程攻击力700%
        RESOURCE_KEANIUM_OXIDE,              // KO - 提高远程攻击力400%
        RESOURCE_KEANIUM_ALKALIDE            // KHO2 - 提高远程攻击力200%
    ],
    [HEAL]: [
        RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, // XLHO2 - 提高治疗力700%
        RESOURCE_LEMERGIUM_OXIDE,              // LO - 提高治疗力400%
        RESOURCE_LEMERGIUM_ALKALIDE            // LHO2 - 提高治疗力200%
    ],
    [TOUGH]: [
        RESOURCE_CATALYZED_GHODIUM_ALKALIDE, // XGHO2 - 减少伤害70%
        RESOURCE_GHODIUM_OXIDE,              // GO - 减少伤害50%
        RESOURCE_GHODIUM_ALKALIDE            // GHO2 - 减少伤害30%
    ],
    [MOVE]: [
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, // XZHO2 - 提高移动速度700%
        RESOURCE_ZYNTHIUM_OXIDE,             // ZO - 提高移动速度400%
        RESOURCE_ZYNTHIUM_ALKALIDE           // ZHO2 - 提高移动速度200%
    ],
    [WORK]: [
        RESOURCE_CATALYZED_ZYNTHIUM_ACID,    // XZH2O - 提高工作效率700% (挖矿)
        RESOURCE_CATALYZED_LEMERGIUM_ACID,   // XLH2O - 提高修理/建造效率700%
        RESOURCE_CATALYZED_UTRIUM_ALKALIDE   // XUH2O - 提高升级效率700%
    ]
};

const managerLab = {
    // 基础配置
    REACTION_INTERVAL: 10, // 每多少tick运行一次Lab管理逻辑
    MIN_REACTION_AMOUNT: 5, // Lab中至少有多少原料才开始反应
    LAB_ENERGY_THRESHOLD: 1000, // Lab至少需要多少能量才执行操作
    
    // 主函数
    run: function(room) {
        // 初始化房间的Lab系统内存
        this.initLabMemory(room);
        
        // 每REACTION_INTERVAL个tick执行一次Lab管理
        if (Game.time % this.REACTION_INTERVAL !== 0) {
            return;
        }
        
        // 清理过期任务
        this.cleanupTasks(room);
        
        // 找到所有Lab
        const labs = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB
        });
        
        if (labs.length < 3) {
            return; // 不足以进行基础反应
        }
        
        // 配置Lab角色
        this.assignLabRoles(room, labs);
        
        // 根据模式处理Labs
        if (room.memory.labs.boostMode) {
            // Boost模式
            this.manageBoostMode(room, labs);
        } else {
            // 反应模式
            // 检查当前生产目标
            if (!this.checkProductionTarget(room)) {
                return; // 无有效生产目标或未处于生产状态
            }
            
            // 管理所有Lab
            this.manageLabs(room, labs);
        }
    },
    
    // 初始化房间的Lab系统内存
    initLabMemory: function(room) {
        if (!room.memory.labs) {
            room.memory.labs = {
                inputLabs: [],       // 输入Lab的ID列表
                outputLabs: [],      // 输出Lab的ID列表
                productionTarget: null, // 当前生产目标
                productionAmount: 3000, // 目标生产量
                status: 'idle',       // idle, producing, paused
                boostMode: false,     // 是否为boost模式
                boostLabs: {}        // 用于boost的Lab配置 {labId: {resourceType, ready}}
            };
        }
        
        if (room.memory.labs && !room.memory.labs.boostLabs) {
            room.memory.labs.boostLabs = {};
        }
        
        if (!room.memory.labTasks) {
            room.memory.labTasks = [];
        }
    },
    
    // 清理过期或无效的Lab任务
    cleanupTasks: function(room) {
        if (!room.memory.labTasks || room.memory.labTasks.length === 0) {
            return;
        }
        
        const initialCount = room.memory.labTasks.length;
        
        room.memory.labTasks = room.memory.labTasks.filter(task => {
            // 检查任务是否过期
            if (task.expiry && Game.time > task.expiry) {
                return false;
            }
            
            // 检查目标Lab是否存在
            const lab = Game.getObjectById(task.labId);
            if (!lab) {
                return false;
            }
            
            // 如果任务已分配，检查分配的Creep是否存在
            if (task.assignee && !Game.getObjectById(task.assignee)) {
                return false;
            }
            
            return true; // 保留有效任务
        });
        
        const finalCount = room.memory.labTasks.length;
        if (initialCount !== finalCount) {
            console.log(`${room.name}: 清理了 ${initialCount - finalCount} 个无效/过期Lab任务`);
        }
    },
    
    // 分配Lab角色
    assignLabRoles: function(room, labs) {
        // 如果处于boost模式，不需要重新分配输入/输出Lab
        if (room.memory.labs.boostMode) {
            return;
        }
        
        // 如果已经有配置好的角色，检查Lab是否仍然存在
        if (room.memory.labs.inputLabs.length > 0 && room.memory.labs.outputLabs.length > 0) {
            // 验证Lab是否仍然存在
            const allValid = [...room.memory.labs.inputLabs, ...room.memory.labs.outputLabs].every(id => 
                Game.getObjectById(id) !== null
            );
            
            if (allValid) return;
            
            // 如果有Lab不存在了，重新分配
            console.log(`${room.name}: 检测到Lab配置变更，重新分配Lab角色`);
        }
        
        // 重置Lab角色
        room.memory.labs.inputLabs = [];
        room.memory.labs.outputLabs = [];
        
        // 根据距离算法优化Lab分配
        this.optimizeLabAssignment(room, labs);
        
        console.log(`${room.name}: Lab角色分配完成 - 输入Labs: ${room.memory.labs.inputLabs.length}, 输出Labs: ${room.memory.labs.outputLabs.length}`);
    },
    
    // 优化Lab分配，使输入Labs靠近一起，输出Labs也靠近各自
    optimizeLabAssignment: function(room, labs) {
        if (labs.length < 3) return;
        
        // 计算所有Lab之间的距离矩阵
        const distanceMatrix = {};
        for (let i = 0; i < labs.length; i++) {
            distanceMatrix[labs[i].id] = {};
            for (let j = 0; j < labs.length; j++) {
                if (i !== j) {
                    distanceMatrix[labs[i].id][labs[j].id] = 
                        labs[i].pos.getRangeTo(labs[j].pos);
                }
            }
        }
        
        // 找到最接近的两个Lab作为输入Labs
        let closestPair = { dist: Infinity, lab1: null, lab2: null };
        for (let i = 0; i < labs.length; i++) {
            for (let j = i + 1; j < labs.length; j++) {
                const dist = distanceMatrix[labs[i].id][labs[j].id];
                if (dist < closestPair.dist) {
                    closestPair = { dist: dist, lab1: labs[i], lab2: labs[j] };
                }
            }
        }
        
        // 将最接近的两个Lab设为输入Labs
        room.memory.labs.inputLabs = [closestPair.lab1.id, closestPair.lab2.id];
        
        // 剩余的Lab设为输出Labs
        room.memory.labs.outputLabs = labs
            .filter(lab => lab.id !== closestPair.lab1.id && lab.id !== closestPair.lab2.id)
            .map(lab => lab.id);
    },
    
    // 管理Boost模式
    manageBoostMode: function(room, labs) {
        // 检查每个配置为boost的Lab
        for (const labId in room.memory.labs.boostLabs) {
            const labConfig = room.memory.labs.boostLabs[labId];
            const lab = Game.getObjectById(labId);
            
            if (!lab) {
                // Lab不存在，删除配置
                delete room.memory.labs.boostLabs[labId];
                continue;
            }
            
            // 检查Lab是否准备好进行boost
            if (!labConfig.ready) {
                // 检查Lab中的矿物类型
                if (lab.mineralType && lab.mineralType !== labConfig.resourceType) {
                    // 需要卸载错误的矿物
                    this.requestLabTask(room, labId, LAB_TASK_TYPE_UNLOAD, lab.mineralType, lab.store[lab.mineralType]);
                } else if (!lab.mineralType || lab.store[labConfig.resourceType] < 1000) {
                    // 需要装载boost资源
                    const amountNeeded = 1000 - (lab.store[labConfig.resourceType] || 0);
                    if (amountNeeded > 0) {
                        this.requestLabTask(room, labId, LAB_TASK_TYPE_LOAD, labConfig.resourceType, amountNeeded);
                    }
                }
                
                // 检查能量
                if (lab.store[RESOURCE_ENERGY] < this.LAB_ENERGY_THRESHOLD) {
                    const energyNeeded = this.LAB_ENERGY_THRESHOLD - lab.store[RESOURCE_ENERGY];
                    this.requestLabTask(room, labId, LAB_TASK_TYPE_LOAD, RESOURCE_ENERGY, energyNeeded);
                }
                
                // 检查Lab是否准备好
                if ((lab.mineralType === labConfig.resourceType && 
                    lab.store[labConfig.resourceType] >= 1000 &&
                    lab.store[RESOURCE_ENERGY] >= this.LAB_ENERGY_THRESHOLD)) {
                    labConfig.ready = true;
                    console.log(`${room.name}: Lab ${labId} 准备好进行 ${labConfig.resourceType} boost`);
                }
            }
        }
    },
    
    // 检查并设置生产目标
    checkProductionTarget: function(room) {
        // 已有生产目标且状态为 producing 或 paused
        if (room.memory.labs.productionTarget && room.memory.labs.status !== 'idle') {
            return true;
        }
        
        // 状态为idle，尝试从队列获取
        if (room.memory.labs.status === 'idle' && room.memory.productionQueue && room.memory.productionQueue.length > 0) {
            const nextTarget = room.memory.productionQueue.shift(); // 取出并移除
            this.setProductionTarget(room, nextTarget.resource, nextTarget.amount);
            return true; // 已设置新目标
        }
        
        // 没有目标或队列为空，且状态是idle
        if (room.memory.labs.status === 'idle') {
             // console.log(`${room.name}: Lab系统空闲，无生产目标或队列为空`);
            return false;
        }
        
        // 其他情况 (例如目标完成但状态未重置?)，视为无效
        return false;
    },
    
    // 设置生产目标
    setProductionTarget: function(room, resource, amount = 3000) {
        // 验证资源是否支持合成
        if (!REACTION_RECIPES[resource]) {
            console.log(`${room.name}: 无法设置生产目标 ${resource} - 不支持的化合物`);
            return false;
        }
        
        // 设置目标
        room.memory.labs.productionTarget = resource;
        room.memory.labs.productionAmount = amount;
        room.memory.labs.status = 'producing';
        // 不再计算反应链
        // room.memory.labs.productionChain = this.calculateReactionChain(resource);
        
        console.log(`${room.name}: 设置新生产目标 ${resource} x${amount}`);
        return true;
    },
    
    // 管理所有Lab的运行 (反应模式)
    manageLabs: function(room, labs) {
        // 检查生产状态
        if (room.memory.labs.status !== 'producing') {
            // console.log(`${room.name}: Lab 生产暂停或空闲`);
            return;
        }
        
        // 获取输入和输出Lab
        const inputLabs = room.memory.labs.inputLabs.map(id => Game.getObjectById(id)).filter(Boolean);
        const outputLabs = room.memory.labs.outputLabs.map(id => Game.getObjectById(id)).filter(Boolean);
        
        if (inputLabs.length < 2 || outputLabs.length < 1) {
            console.log(`${room.name}: Lab数量不足，无法进行反应`);
            return;
        }
        
        // 获取当前直接反应目标
        const currentReaction = this.determineCurrentReaction(room);
        if (!currentReaction) {
            console.log(`${room.name}: 无法确定当前反应 (${room.memory.labs.productionTarget})`);
            // 可能目标是基础资源或无效
            room.memory.labs.status = 'idle'; // 重置状态
            return;
        }
        
        // 管理输入Labs，确保它们有当前反应所需的直接原料
        this.manageInputLabs(room, inputLabs[0], inputLabs[1], currentReaction.input1, currentReaction.input2);
        
        // 管理输出Labs，运行反应并处理产物
        for (const outputLab of outputLabs) {
            this.manageOutputLab(room, outputLab, inputLabs[0], inputLabs[1], currentReaction.output);
        }
        
        // 检查是否达到目标生产量
        this.checkProductionCompletion(room);
    },
    
    // 确定当前应该进行的反应 (直接查找目标配方)
    determineCurrentReaction: function(room) {
        const target = room.memory.labs.productionTarget;
        if (!target) return null;
        
        const recipe = REACTION_RECIPES[target];
        if (!recipe) {
             console.log(`${room.name}: 目标 ${target} 不是可合成资源`);
             return null; // 目标无法合成
        }
        
        const [input1, input2] = recipe.components;
        
        return {
            output: target,
            input1: input1,
            input2: input2
        };
    },
    
    // 管理输入Lab
    manageInputLabs: function(room, inputLab1, inputLab2, resource1, resource2) {
        this.manageInputLab(room, inputLab1, resource1);
        this.manageInputLab(room, inputLab2, resource2);
    },
    
    // 管理单个输入Lab
    manageInputLab: function(room, lab, expectedResource) {
        if (!lab) return;

        // 卸载非预期资源
        if (lab.mineralType && lab.mineralType !== expectedResource) {
            this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, lab.mineralType, lab.store[lab.mineralType]);
            return; // 优先卸载
        }
        
        // 卸载能量（输入Lab通常不需要能量）
        if (lab.store[RESOURCE_ENERGY] > 0) {
             this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, RESOURCE_ENERGY, lab.store[RESOURCE_ENERGY]);
             return; // 优先卸载能量
        }
        
        // 装载预期资源
        const currentAmount = lab.store[expectedResource] || 0;
        const freeCapacity = lab.store.getFreeCapacity(expectedResource);

        if (currentAmount < 1000 && freeCapacity >= 50 && !this.hasPendingLoadTask(room, lab.id, expectedResource)) { // 需要量 & 有空间 & 无加载任务
            const amountToLoad = Math.min(1000 - currentAmount, freeCapacity);
            this.requestLabTask(room, lab.id, LAB_TASK_TYPE_LOAD, expectedResource, amountToLoad);
        }
    },
    
    // 管理输出Lab
    manageOutputLab: function(room, lab, inputLab1, inputLab2, expectedOutput) {
        if (!lab || !inputLab1 || !inputLab2) return;

        // 卸载非目标产物
        for (const resourceType in lab.store) {
            if (resourceType !== expectedOutput && resourceType !== RESOURCE_ENERGY && lab.store[resourceType] > 0) {
                 this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, resourceType, lab.store[resourceType]);
                 return; // 优先卸载
            }
        }
        
        // 检查能量水平
        const currentEnergy = lab.store[RESOURCE_ENERGY] || 0;
        if (currentEnergy < this.LAB_ENERGY_THRESHOLD) {
             const neededEnergy = this.LAB_ENERGY_THRESHOLD - currentEnergy;
             this.requestLabTask(room, lab.id, LAB_TASK_TYPE_LOAD, RESOURCE_ENERGY, neededEnergy);
             // 请求能量后可以继续尝试反应
        }

        // 运行反应
        const input1Mineral = inputLab1.mineralType;
        const input2Mineral = inputLab2.mineralType;
        const recipe = REACTION_RECIPES[expectedOutput];

        if (!recipe) return; // 无效的产物

        const [recipeInput1, recipeInput2] = recipe.components;

        let actualInputLab1 = null;
        let actualInputLab2 = null;

        // 确定哪个输入Lab对应哪个原料
        if(input1Mineral === recipeInput1 && input2Mineral === recipeInput2) {
            actualInputLab1 = inputLab1;
            actualInputLab2 = inputLab2;
        } else if (input1Mineral === recipeInput2 && input2Mineral === recipeInput1) {
            actualInputLab1 = inputLab2; // 注意交换
            actualInputLab2 = inputLab1;
        }
        
        if (actualInputLab1 && actualInputLab2) {
            const canRunReaction =
                !lab.cooldown &&
                actualInputLab1.store[recipeInput1] >= this.MIN_REACTION_AMOUNT &&
                actualInputLab2.store[recipeInput2] >= this.MIN_REACTION_AMOUNT &&
                lab.store.getFreeCapacity(expectedOutput) >= this.MIN_REACTION_AMOUNT &&
                currentEnergy >= LAB_REACTION_AMOUNT;

            if (canRunReaction) {
                const result = lab.runReaction(actualInputLab1, actualInputLab2);
                if (result === OK) {
                    // 成功运行反应
                } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
                    // 理论上不应该发生，因为前面检查了，但以防万一
                    console.log(`${room.name} Lab ${lab.id} runReaction ${expectedOutput} failed: ERR_NOT_ENOUGH_RESOURCES despite checks.`);
                } else {
                     console.log(`${room.name} Lab ${lab.id} runReaction ${expectedOutput} failed: ${result}`);
                }
                return; // 无论成功失败，执行过反应就结束
            }
        }
        
        // 检查是否需要卸载产物
        const outputAmount = lab.store[expectedOutput] || 0;
        const capacityThreshold = lab.store.getCapacity(expectedOutput) * 0.8; // 80%容量时卸载
        
        if (outputAmount >= capacityThreshold && !this.hasPendingUnloadTask(room, lab.id, expectedOutput)) {
            this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, expectedOutput, outputAmount);
        }
    },
    
    // 检查生产是否完成
    checkProductionCompletion: function(room) {
        const target = room.memory.labs.productionTarget;
        const targetAmount = room.memory.labs.productionAmount;
        
        if (!target || !targetAmount) return;
        
        // 计算已生产的数量（存储+终端）
        const storageAmount = room.storage ? (room.storage.store[target] || 0) : 0;
        const terminalAmount = room.terminal ? (room.terminal.store[target] || 0) : 0;
        const totalProduced = storageAmount + terminalAmount;
        
        // 如果达到或超过目标，完成生产
        if (totalProduced >= targetAmount) {
            console.log(`${room.name}: 生产目标已完成! ${target} x${totalProduced}`);
            room.memory.labs.status = 'idle';
            room.memory.labs.productionTarget = null;
            
            // 卸载所有Lab中的资源
            this.unloadAllLabs(room);
        }
    },
    
    // 卸载所有Lab中的资源
    unloadAllLabs: function(room) {
        const labIds = [...room.memory.labs.inputLabs, ...room.memory.labs.outputLabs];
        
        for (const id of labIds) {
            const lab = Game.getObjectById(id);
            if (!lab) continue;
            
            for (const resourceType in lab.store) {
                // 保留能量用于卸载任务？或者让hauler自己带能量？简单起见，先全卸载
                if (lab.store[resourceType] > 0) {
                    this.requestLabTask(room, id, LAB_TASK_TYPE_UNLOAD, resourceType, lab.store[resourceType]);
                }
            }
        }
    },

    // 设置Lab为boost模式
    setBoostMode: function(room, enabled = true) {
        if (!room || !room.memory.labs) {
            return `错误: 房间 ${room ? room.name : '未知'} 没有初始化Lab系统`;
        }
        
        room.memory.labs.boostMode = enabled;
        
        // 如果启用boost模式，清空所有现有任务和生产目标
        if (enabled) {
            room.memory.labs.productionTarget = null;
            room.memory.labs.status = 'idle';
            
            // 卸载所有输入Lab中非能量资源
            for (const labId of room.memory.labs.inputLabs) {
                const lab = Game.getObjectById(labId);
                if (lab && lab.mineralType) {
                    this.requestLabTask(room, labId, LAB_TASK_TYPE_UNLOAD, lab.mineralType, lab.store[lab.mineralType]);
                }
            }
        }
        
        return `房间 ${room.name} 的Lab系统已${enabled ? '切换为boost模式' : '切换为反应模式'}`;
    },
    
    // 设置特定Lab为boost Lab
    setBoostLab: function(room, labId, resourceType) {
        if (!room || !room.memory.labs) {
            return `错误: 房间 ${room ? room.name : '未知'} 没有初始化Lab系统`;
        }
        
        const lab = Game.getObjectById(labId);
        if (!lab) {
            return `错误: 找不到ID为 ${labId} 的Lab`;
        }
        
        // 验证资源类型是否是有效的boost化合物
        let isValidBoost = false;
        for (const bodyPart in BOOST_COMPOUNDS) {
            if (BOOST_COMPOUNDS[bodyPart].includes(resourceType)) {
                isValidBoost = true;
                break;
            }
        }
        
        if (!isValidBoost) {
            return `错误: ${resourceType} 不是有效的boost化合物`;
        }
        
        // 设置Lab为boost模式
        this.setBoostMode(room, true);
        
        // 配置该Lab为boost Lab
        if (!room.memory.labs.boostLabs) {
            room.memory.labs.boostLabs = {};
        }
        
        room.memory.labs.boostLabs[labId] = {
            resourceType: resourceType,
            ready: false
        };
        
        // 请求装载资源
        if (!lab.mineralType || lab.mineralType !== resourceType || lab.store[resourceType] < 1000) {
            const amountNeeded = 1000 - (lab.store[resourceType] || 0);
            if (amountNeeded > 0) {
                this.requestLabTask(room, labId, LAB_TASK_TYPE_LOAD, resourceType, amountNeeded);
            }
        }
        
        // 请求装载能量
        if (lab.store[RESOURCE_ENERGY] < this.LAB_ENERGY_THRESHOLD) {
            const energyNeeded = this.LAB_ENERGY_THRESHOLD - lab.store[RESOURCE_ENERGY];
            this.requestLabTask(room, labId, LAB_TASK_TYPE_LOAD, RESOURCE_ENERGY, energyNeeded);
        }
        
        return `已将房间 ${room.name} 的Lab ${labId} 设置为 ${resourceType} boost实验室`;
    },
    
    // 重新分配所有Lab
    reassignLabs: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }
        
        // 重置Lab配置
        if (room.memory.labs) {
            room.memory.labs.inputLabs = [];
            room.memory.labs.outputLabs = [];
        } else {
            this.initLabMemory(room);
        }
        
        // 找到所有Lab
        const labs = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB
        });
        
        if (labs.length < 3) {
            return `错误: 房间 ${roomName} 没有足够的Lab (需要至少3个)`;
        }
        
        // 重新分配Lab角色
        this.optimizeLabAssignment(room, labs);
        
        return `已重新分配房间 ${roomName} 的Lab角色: 输入Labs: ${room.memory.labs.inputLabs.length}, 输出Labs: ${room.memory.labs.outputLabs.length}`;
    },
    
    // --- 任务管理辅助函数 --- //
    requestLabTask: function(room, labId, taskType, resourceType, amount) {
        if (!room.memory.labTasks) {
            room.memory.labTasks = [];
        }
        
        // 检查是否已有相同目标的任务
        const existingTask = room.memory.labTasks.find(t => 
            t.labId === labId && 
            t.resourceType === resourceType && 
            t.type === taskType
        );
        
        if (existingTask) {
            // 更新现有任务的数量
            existingTask.amount = Math.max(existingTask.amount, amount);
            return;
        }

        const taskId = `lab_${Game.time}_${Math.random().toString(36).substring(2, 5)}`;
        room.memory.labTasks.push({
            id: taskId,
            labId: labId,
            type: taskType,
            resourceType: resourceType,
            amount: amount,
            priority: (taskType === LAB_TASK_TYPE_UNLOAD) ? 2 : 1, // 优先卸载
            assignee: null,
            expiry: Game.time + 500 // 500tick有效期
        });
    },

    hasPendingLoadTask: function(room, labId, resourceType) {
        if (!room.memory.labTasks) return false;
        return room.memory.labTasks.some(t => 
            t.labId === labId && 
            t.type === LAB_TASK_TYPE_LOAD && 
            t.resourceType === resourceType);
    },

    hasPendingUnloadTask: function(room, labId, resourceType) {
        if (!room.memory.labTasks) return false;
        return room.memory.labTasks.some(t => 
            t.labId === labId && 
            t.type === LAB_TASK_TYPE_UNLOAD && 
            t.resourceType === resourceType);
    },
    
    // --- 用户接口函数 --- //
    setRoomTarget: function(roomName, resource, amount = 3000) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }
        
        if (!REACTION_RECIPES[resource]) {
            return `错误: ${resource} 不是可合成的资源`;
        }
        
        // 关闭boost模式
        if (room.memory.labs && room.memory.labs.boostMode) {
            this.setBoostMode(room, false);
        }
        
        if (this.setProductionTarget(room, resource, amount)) {
            return `成功: 房间 ${roomName} 的生产目标设置为 ${resource} x${amount}`;
        } else {
            return `错误: 无法设置生产目标`;
        }
    },
    
    addToQueue: function(roomName, resource, amount = 3000) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }
        
        if (!REACTION_RECIPES[resource]) {
            return `错误: ${resource} 不是可合成的资源`;
        }
        
        if (!room.memory.productionQueue) {
            room.memory.productionQueue = [];
        }
        
        room.memory.productionQueue.push({ resource, amount });
        return `成功: 添加 ${resource} x${amount} 到房间 ${roomName} 的生产队列`;
    },
    
    clearQueue: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }
        
        room.memory.productionQueue = [];
        return `成功: 清空房间 ${roomName} 的生产队列`;
    },
    
    getStatus: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `错误: 无法访问房间 ${roomName}`;
        }
        
        if (!room.memory.labs) {
            return `房间 ${roomName} 没有初始化Lab系统`;
        }
        
        const status = room.memory.labs;
        let report = `房间 ${roomName} Lab状态:\n`;
        report += `模式: ${status.boostMode ? 'Boost模式' : '反应模式'}\n`;
        
        if (status.boostMode) {
            report += `Boost实验室:\n`;
            for (const labId in status.boostLabs) {
                const lab = Game.getObjectById(labId);
                const labConfig = status.boostLabs[labId];
                if (lab) {
                    report += `- Lab ${labId.substring(0, 4)}...: ${labConfig.resourceType} (${labConfig.ready ? '已就绪' : '准备中'})\n`;
                }
            }
        } else {
            report += `状态: ${status.status || 'idle'}\n`;
            report += `当前目标: ${status.productionTarget || '无'}\n`;
            
            if (status.productionTarget) {
                report += `目标数量: ${status.productionAmount}\n`;
                
                // 计算已生产的数量
                const target = status.productionTarget;
                const storageAmount = room.storage ? (room.storage.store[target] || 0) : 0;
                const terminalAmount = room.terminal ? (room.terminal.store[target] || 0) : 0;
                const totalProduced = storageAmount + terminalAmount; // 只计算存储和终端中的
                report += `已生产(库存): ${totalProduced} (存储: ${storageAmount}, 终端: ${terminalAmount})\n`;
            }
            
            report += `输入Labs: ${status.inputLabs.length > 0 ? status.inputLabs.map(id=>id.substring(0,4)+'..') : '未分配'}\n`;
            report += `输出Labs: ${status.outputLabs.length > 0 ? status.outputLabs.map(id=>id.substring(0,4)+'..') : '未分配'}\n`;
        }
        
        report += `待处理任务: ${room.memory.labTasks ? room.memory.labTasks.length : 0}\n`;
        
        if (room.memory.productionQueue && room.memory.productionQueue.length > 0) {
            report += `生产队列: ${room.memory.productionQueue.map(item => `${item.resource}x${item.amount}`).join(', ')}`;
        }
        
        return report;
    },
    
    pauseProduction: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.memory.labs) return `错误: 无法访问房间 ${roomName} 或Lab系统未初始化`;
        
        room.memory.labs.status = 'paused';
        return `成功: 暂停房间 ${roomName} 的Lab生产`;
    },
    
    resumeProduction: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !room.memory.labs) return `错误: 无法访问房间 ${roomName} 或Lab系统未初始化`;
        
        room.memory.labs.status = 'producing';
        return `成功: 恢复房间 ${roomName} 的Lab生产`;
    }
}; // managerLab 对象结束

// 将管理器添加到全局对象，以便在控制台中使用
global.labManager = managerLab;

module.exports = managerLab;