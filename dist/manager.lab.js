/**
 * Lab 管理器模块
 * 负责协调房间内 Lab 的化学反应和资源管理
 */
const LAB_TASK_TYPE_LOAD = 'load';
const LAB_TASK_TYPE_UNLOAD = 'unload';

const managerLab = {
    // --- 配置 ---
    REACTION_INTERVAL: 10, // 每多少 tick 运行一次 Lab 管理逻辑
    MIN_REACTION_AMOUNT: 5, // Lab 中至少有多少原料才开始反应
    TARGET_COMPOUND: RESOURCE_HYDROXIDE, // OH - 示例目标产物
    SOURCE_COMPOUND_1: RESOURCE_OXYGEN,   // O
    SOURCE_COMPOUND_2: RESOURCE_HYDROGEN, // H
    OUTPUT_LAB_COUNT: 1, // 用于输出和执行反应的 Lab 数量
    LAB_ENERGY_THRESHOLD: 1000, // Lab 至少需要多少能量才执行操作

    // --- 主函数 ---
    run: function(room) {
        if (Game.time % this.REACTION_INTERVAL !== 0) {
            return;
        }

        const labs = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB
        });

        if (labs.length < 3) {
            // 至少需要3个Lab才能进行基础的两原料一产物反应
            return;
        }

        // 初始化 Lab 任务队列
        if (!room.memory.labTasks) {
            room.memory.labTasks = [];
        }
        // 清理已完成或过时的任务 (简单实现，可以根据需要优化)
        room.memory.labTasks = room.memory.labTasks.filter(task => Game.getObjectById(task.creepId) || Game.time < task.expiry);


        // --- Lab 角色分配 (简单示例：前两个是输入，其余是输出/反应 Lab) ---
        const inputLabs = labs.slice(0, 2);
        const outputLabs = labs.slice(2); // 所有剩余的Lab都视为反应/输出Lab

        if (inputLabs.length < 2 || outputLabs.length < 1) return; // 结构不满足

        const inputLab1 = inputLabs[0];
        const inputLab2 = inputLabs[1];

        // --- 管理输入 Lab ---
        this.manageInputLab(room, inputLab1, this.SOURCE_COMPOUND_1);
        this.manageInputLab(room, inputLab2, this.SOURCE_COMPOUND_2);

        // --- 管理输出/反应 Lab ---
        for (const outputLab of outputLabs) {
            this.manageOutputLab(room, outputLab, inputLab1, inputLab2);
        }
    },

    // --- Lab 管理函数 ---

    /**
     * 管理输入 Lab：确保有足够的原料，没有多余的产物
     * @param {Room} room
     * @param {StructureLab} lab
     * @param {ResourceConstant} expectedResource - 该 Lab 期望装载的资源
     */
    manageInputLab: function(room, lab, expectedResource) {
        if (!lab) return;

        // 1. 卸载非预期资源 (包括能量，如果不需要能量的话)
        for (const resourceType in lab.store) {
            if (resourceType !== expectedResource && resourceType !== RESOURCE_ENERGY && lab.store[resourceType] > 0) {
                this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, resourceType, lab.store[resourceType]);
                return; // 优先卸载
            }
        }
         // 如果Lab有能量但不需要（通常输入Lab不需要），也卸载掉
        if(lab.store[RESOURCE_ENERGY] > 0) {
             this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, RESOURCE_ENERGY, lab.store[RESOURCE_ENERGY]);
             return; // 优先卸载能量
        }


        // 2. 请求装载预期资源
        const currentAmount = lab.store[expectedResource] || 0;
        const freeCapacity = lab.store.getFreeCapacity(expectedResource);

        if (freeCapacity >= lab.store.getCapacity(expectedResource) * 0.2 && // 至少有20%空余容量
            !this.hasPendingLoadTask(room, lab.id, expectedResource)) { // 并且没有正在进行的装载任务
            
            const neededAmount = lab.store.getCapacity(expectedResource) - currentAmount;
            // 请求从 Storage/Terminal 装载资源
            this.requestLabTask(room, lab.id, LAB_TASK_TYPE_LOAD, expectedResource, neededAmount);
        }
    },

    /**
     * 管理输出 Lab：运行反应，卸载产物
     * @param {Room} room
     * @param {StructureLab} lab - 进行反应的 Lab
     * @param {StructureLab} inputLab1
     * @param {StructureLab} inputLab2
     */
    manageOutputLab: function(room, lab, inputLab1, inputLab2) {
        if (!lab || !inputLab1 || !inputLab2) return;

        const targetCompound = this.TARGET_COMPOUND;
        const source1 = this.SOURCE_COMPOUND_1;
        const source2 = this.SOURCE_COMPOUND_2;

        // 1. 卸载非目标产物 (或能量，如果不需要)
        for (const resourceType in lab.store) {
            if (resourceType !== targetCompound && resourceType !== RESOURCE_ENERGY && lab.store[resourceType] > 0) {
                 this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, resourceType, lab.store[resourceType]);
                 return; // 优先卸载
            }
        }
         // 如果Lab有能量但能量低于阈值，需要补充
        const currentEnergy = lab.store[RESOURCE_ENERGY] || 0;
        if (currentEnergy < this.LAB_ENERGY_THRESHOLD && lab.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && !this.hasPendingLoadTask(room, lab.id, RESOURCE_ENERGY)) {
             const neededEnergy = this.LAB_ENERGY_THRESHOLD - currentEnergy;
             this.requestLabTask(room, lab.id, LAB_TASK_TYPE_LOAD, RESOURCE_ENERGY, neededEnergy);
             // 注意：这里不return，允许在请求能量的同时检查是否可以反应
        }


        // 2. 检查是否可以进行反应
        const canRunReaction =
            !lab.cooldown &&
            inputLab1.store[source1] >= this.MIN_REACTION_AMOUNT &&
            inputLab2.store[source2] >= this.MIN_REACTION_AMOUNT &&
            lab.store.getFreeCapacity(targetCompound) >= this.MIN_REACTION_AMOUNT && // 确保有空间容纳产物
            currentEnergy >= LAB_REACTION_AMOUNT; // 确保有能量进行反应 (注意: LAB_REACTION_AMOUNT 是 Screeps 常量=5)

        if (canRunReaction) {
            const result = lab.runReaction(inputLab1, inputLab2);
            if (result === OK) {
                // console.log(`${room.name} Lab ${lab.id} run reaction: ${source1} + ${source2} -> ${targetCompound}`);
            } else {
                // console.log(`${room.name} Lab ${lab.id} run reaction failed: ${result}`);
                // 如果失败是因为缺少能量，请求能量
                 if (result === ERR_NOT_ENOUGH_RESOURCES && currentEnergy < LAB_REACTION_AMOUNT && !this.hasPendingLoadTask(room, lab.id, RESOURCE_ENERGY)) {
                      this.requestLabTask(room, lab.id, LAB_TASK_TYPE_LOAD, RESOURCE_ENERGY, this.LAB_ENERGY_THRESHOLD - currentEnergy);
                 }
            }
            return; // 进行了反应或尝试反应，本轮结束
        }

        // 3. 如果无法反应，检查是否需要卸载产物
        const outputAmount = lab.store[targetCompound] || 0;
        if (outputAmount >= lab.store.getCapacity(targetCompound) * 0.5 && // 产物超过容量的一半
            !this.hasPendingUnloadTask(room, lab.id, targetCompound)) { // 且没有正在进行的卸载任务
            this.requestLabTask(room, lab.id, LAB_TASK_TYPE_UNLOAD, targetCompound, outputAmount);
        }
    },

    // --- 任务管理辅助函数 ---

    /**
     * 请求 Lab 运输任务
     * @param {Room} room
     * @param {string} labId
     * @param {string} taskType - 'load' or 'unload'
     * @param {ResourceConstant} resourceType
     * @param {number} amount
     */
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
            // 可选：更新现有任务的数量，或忽略新请求
            // console.log(`Lab task already exists for ${labId}, ${taskType}, ${resourceType}`);
            return;
        }

        const taskId = `lab_${Game.time}_${Math.random().toString(36).substring(2, 5)}`;
        room.memory.labTasks.push({
            id: taskId,
            labId: labId,
            type: taskType, // 'load' or 'unload'
            resourceType: resourceType,
            amount: amount,
            priority: (taskType === LAB_TASK_TYPE_UNLOAD) ? 2 : 1, // 优先卸载
            assignee: null, // 由 labHauler 认领
            expiry: Game.time + 100 // 任务有效期，防止卡死
        });
         console.log(`房间 ${room.name} 创建 Lab 任务: ${taskType} ${amount} ${resourceType} for Lab ${labId}`);
    },

    /**
     * 检查指定 Lab 是否有待处理的装载任务
     */
    hasPendingLoadTask: function(room, labId, resourceType) {
        if (!room.memory.labTasks) return false;
        return room.memory.labTasks.some(t => 
            t.labId === labId && 
            t.type === LAB_TASK_TYPE_LOAD && 
            t.resourceType === resourceType);
    },

    /**
     * 检查指定 Lab 是否有待处理的卸载任务
     */
    hasPendingUnloadTask: function(room, labId, resourceType) {
        if (!room.memory.labTasks) return false;
        return room.memory.labTasks.some(t => 
            t.labId === labId && 
            t.type === LAB_TASK_TYPE_UNLOAD && 
            t.resourceType === resourceType);
    }

};

module.exports = managerLab; 