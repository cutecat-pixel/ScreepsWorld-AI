/**
 * 终端管理器模块
 * 负责管理终端交易，支持多种矿物和化合物资源的自动交易
 */
const managerTerminal = {
    /**
     * 终端管理器的主要运行逻辑
     * @param {Room} room - 要管理终端的房间
     */
    run: function(room) {
        // 检查房间是否有终端
        const terminal = room.terminal;
        if(!terminal) return;
        
        // 每20tick检查一次交易
        if(Game.time % 20 !== 0) return;
        
        // 检查终端是否激活
        if(!terminal.isActive()) {
            console.log(`房间 ${room.name} 的终端未激活`);
            return;
        }
        
        // 检查是否开启了自动交易
        if(!room.memory.autoTrading) {
            room.memory.autoTrading = { enabled: false, resources: {} };
        }
        
        // 检查终端是否有长期订单
        this.checkTerminalOrders(room, terminal);
        
        // 如果自动交易已启用，处理交易
        if(room.memory.autoTrading.enabled) {
            this.processResourceTrading(room, terminal);
        }
    },
    
    /**
     * 检查终端是否有长期订单，并确保有足够能量
     * @param {Room} room - 房间对象
     * @param {StructureTerminal} terminal - 终端对象
     */
    checkTerminalOrders: function(room, terminal) {
        // 如果没有storage，无法补充能量
        if(!room.storage) return;
        
        // 检查是否有活跃的长期订单
        const myActiveOrders = Game.market.orders ? Object.values(Game.market.orders).filter(
            order => order.roomName === room.name && order.active
        ) : [];
        
        // 如果没有活跃订单，不需要维持能量水平
        if(myActiveOrders.length === 0) return;
        
        // 初始化终端能量配置
        if(!room.memory.terminalEnergyConfig) {
            room.memory.terminalEnergyConfig = {
                minEnergy: 5000,    // 最小能量水平
                checkInterval: 100  // 检查间隔tick
            };
        }
        
        const config = room.memory.terminalEnergyConfig;
        
        // 检查是否需要检查能量水平（按照设定的间隔）
        if(Game.time % config.checkInterval === 0 || !terminal.store[RESOURCE_ENERGY]) {
            const terminalEnergy = terminal.store[RESOURCE_ENERGY] || 0;
            
            // 如果终端能量低于设定值，补充能量
            if(terminalEnergy < config.minEnergy) {
                const neededEnergy = config.minEnergy - terminalEnergy;
                this.requestEnergyTransfer(room, neededEnergy);
                console.log(`房间 ${room.name} 检测到长期订单，自动补充终端能量至 ${config.minEnergy}`);
            }
        }
    },
    
    /**
     * 设置终端能量维护配置
     * @param {string} roomName - 房间名称
     * @param {number} minEnergy - 维持的最小能量水平
     * @param {number} checkInterval - 检查间隔（tick）
     * @returns {string} - 操作结果信息
     */
    setTerminalEnergyMaintenance: function(roomName, minEnergy = 5000, checkInterval = 100) {
        const room = Game.rooms[roomName];
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        if(!room.terminal) {
            return `错误：房间 ${roomName} 没有终端设施`;
        }
        
        if(!room.storage) {
            return `错误：房间 ${roomName} 没有存储设施，无法维持能量供应`;
        }
        
        // 更新或创建终端能量配置
        room.memory.terminalEnergyConfig = {
            minEnergy: minEnergy,
            checkInterval: checkInterval
        };
        
        // 立即检查并补充能量
        const terminalEnergy = room.terminal.store[RESOURCE_ENERGY] || 0;
        if(terminalEnergy < minEnergy) {
            const neededEnergy = minEnergy - terminalEnergy;
            this.requestEnergyTransfer(room, neededEnergy);
            return `已配置终端能量维护（最小: ${minEnergy}, 检查间隔: ${checkInterval}tick）并立即补充 ${neededEnergy} 能量`;
        }
        
        return `已配置终端能量维护（最小: ${minEnergy}, 检查间隔: ${checkInterval}tick）`;
    },
    
    /**
     * 禁用终端能量维护
     * @param {string} roomName - 房间名称
     * @returns {string} - 操作结果信息
     */
    disableTerminalEnergyMaintenance: function(roomName) {
        const room = Game.rooms[roomName];
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        if(!room.memory.terminalEnergyConfig) {
            return `房间 ${roomName} 没有配置终端能量维护`;
        }
        
        delete room.memory.terminalEnergyConfig;
        return `房间 ${roomName} 的终端能量维护已禁用`;
    },
    
    /**
     * 处理所有已配置资源的自动交易
     * @param {Room} room - 房间对象
     * @param {StructureTerminal} terminal - 终端对象
     */
    processResourceTrading: function(room, terminal) {
        // 遍历所有配置的资源
        for (const resourceType in room.memory.autoTrading.resources) {
            // 检查该资源是否配置了自动交易
            if (!room.memory.autoTrading.resources[resourceType]) {
                continue;
            }
            
            const config = room.memory.autoTrading.resources[resourceType];
            const minAmount = config.minAmount || 1000; // 保留的最小数量
            const storage = room.storage;
            
            // 获取当前房间资源总量(包括storage和terminal)
            let currentAmount = terminal.store[resourceType] || 0;
            if (storage) {
                currentAmount += storage.store[resourceType] || 0;
            }
            
            // 打印资源总量信息（如果超过保留量）
            if (currentAmount > minAmount) {
                console.log(`房间 ${room.name} ${resourceType}总量: ${currentAmount}`);
            }
            
            // 检查是否有足够的资源满足保留量
            if (currentAmount <= minAmount) {
                continue;
            }
            
            // 检查是否有未完成的订单
            if (config.orderId) {
                this.checkExistingOrder(room, terminal, resourceType, config, currentAmount, minAmount);
            } else {
                // 如果没有活跃订单，寻找新订单
                this.findNewResourceOrder(room, terminal, resourceType, currentAmount, minAmount);
            }
        }
    },
    
    /**
     * 检查现有的资源订单
     */
    checkExistingOrder: function(room, terminal, resourceType, config, currentAmount, minAmount) {
        const orderId = config.orderId;
        const order = Game.market.getOrderById(orderId);
        
        // 如果订单不存在或已完成，清除订单ID
        if(!order || order.remainingAmount === 0) {
            console.log(`房间 ${room.name} 的${resourceType}订单 ${orderId} 已完成或不存在，清除记录`);
            delete room.memory.autoTrading.resources[resourceType].orderId;
            return;
        }
        
        // 计算可以交易的数量
        const availableAmount = currentAmount - minAmount;
        const amountToTrade = Math.min(availableAmount, order.remainingAmount);
        
        // 确保终端有足够的资源
        if(terminal.store[resourceType] < amountToTrade) {
            // 需要从Storage转移资源到Terminal
            const neededAmount = amountToTrade - terminal.store[resourceType];
            this.requestResourceTransfer(room, resourceType, neededAmount);
            return;
        }
        
        // 确保终端有足够的能量支付交易费用
        const tradeCost = Game.market.calcTransactionCost(amountToTrade, room.name, order.roomName);
        if(terminal.store[RESOURCE_ENERGY] < tradeCost) {
            // 需要从Storage转移能量到Terminal
            const neededEnergy = tradeCost - terminal.store[RESOURCE_ENERGY];
            this.requestEnergyTransfer(room, neededEnergy);
            return;
        }
        
        // 执行交易
        const result = Game.market.deal(orderId, amountToTrade, room.name);
        if(result === OK) {
            console.log(`房间 ${room.name} 成功交易 ${amountToTrade} 单位${resourceType}，订单ID: ${orderId}`);
            
            // 如果订单已经完成，清除订单ID
            if(order.remainingAmount - amountToTrade <= 0) {
                delete room.memory.autoTrading.resources[resourceType].orderId;
            }
        } else {
            console.log(`房间 ${room.name} 交易${resourceType}失败，错误代码: ${result}`);
            
            // 如果交易失败(例如订单不存在)，清除订单ID
            if(result === ERR_INVALID_ARGS) {
                delete room.memory.autoTrading.resources[resourceType].orderId;
            }
        }
    },
    
    /**
     * 寻找新的资源订单
     */
    findNewResourceOrder: function(room, terminal, resourceType, currentAmount, minAmount) {
        // 计算可以交易的数量
        const availableAmount = currentAmount - minAmount;
        if(availableAmount <= 0) return;
        
        // 查找市场上所有购买该资源的订单
        const orders = Game.market.getAllOrders({
            resourceType: resourceType,
            type: ORDER_BUY
        });
        
        if(!orders || orders.length === 0) {
            return; // 市场上没有该资源的购买订单，静默返回
        }
        
        // 按照价格从高到低排序订单
        orders.sort((a, b) => b.price - a.price);
        
        // 获取价格阈值（如果已配置）
        const minPrice = room.memory.autoTrading.resources[resourceType].minPrice || 0;
        
        // 查找价格最好的有效订单
        for(const order of orders) {
            // 检查订单是否有效
            if(order.amount <= 0 || order.remainingAmount <= 0) continue;
            
            // 检查价格是否满足最低要求
            if(order.price < minPrice) {
                console.log(`房间 ${room.name} 找到 ${resourceType} 订单，但价格 ${order.price} 低于最低要求 ${minPrice}`);
                continue;
            }
            
            // 计算交易成本
            const tradeCost = Game.market.calcTransactionCost(
                Math.min(availableAmount, order.remainingAmount), 
                room.name, 
                order.roomName
            );
            
            // 确保有足够能量支付交易费用
            const totalEnergyNeeded = tradeCost;
            const totalEnergyAvailable = terminal.store[RESOURCE_ENERGY] + 
                                        (room.storage ? room.storage.store[RESOURCE_ENERGY] || 0 : 0);
            
            if(totalEnergyAvailable < totalEnergyNeeded) {
                console.log(`房间 ${room.name} 能量不足以支付交易费用，需要: ${totalEnergyNeeded}，可用: ${totalEnergyAvailable}`);
                continue;
            }
            
            // 如果订单满足条件，保存该订单ID
            room.memory.autoTrading.resources[resourceType].orderId = order.id;
            console.log(`房间 ${room.name} 找到新的${resourceType}订单，ID: ${order.id}，价格: ${order.price}`);
            
            // 接下来的tick会处理这个订单
            break;
        }
    },
    
    /**
     * 请求从Storage转移资源到Terminal
     */
    requestResourceTransfer: function(room, resourceType, amount) {
        if(!room.storage || !room.terminal) return;
        
        // 检查storage中是否有足够的资源
        const availableInStorage = room.storage.store[resourceType] || 0;
        if(availableInStorage < amount) {
            console.log(`房间 ${room.name} 的Storage中${resourceType}不足，无法转移到Terminal，需要: ${amount}，可用: ${availableInStorage}`);
            return;
        }
        
        // 在房间内存中创建运输任务
        if(!room.memory.terminalTasks) {
            room.memory.terminalTasks = [];
        }
        
        // 检查是否已有相同类型的任务
        const existingTask = _.find(room.memory.terminalTasks, task => 
            task.resource === resourceType && 
            task.from === 'storage' && 
            task.to === 'terminal'
        );
        
        if(existingTask) {
            // 更新现有任务的数量
            existingTask.amount += amount;
            console.log(`房间 ${room.name} 更新了${resourceType}转移任务，从Storage转移 ${existingTask.amount} 单位到Terminal`);
        } else {
            // 添加新的运输任务
            room.memory.terminalTasks.push({
                id: Game.time.toString() + resourceType,
                type: 'transfer',
                resource: resourceType,
                amount: amount,
                from: 'storage',
                to: 'terminal',
                priority: 2 // 高优先级
            });
            
            console.log(`房间 ${room.name} 创建了${resourceType}转移任务，从Storage转移 ${amount} 单位到Terminal`);
        }
    },
    
    /**
     * 从Storage向Terminal请求能量转移
     * @param {Room} room - 房间对象
     * @param {number} amount - 需要转移的能量数量
     */
    requestEnergyTransfer: function(room, amount) {
        if(!room.storage || !room.terminal) return;
        
        // 检查storage中是否有足够的能量
        const availableInStorage = room.storage.store[RESOURCE_ENERGY] || 0;
        
        // 如果Storage能量不足，尝试转移现有能量，并记录警告
        const actualAmount = Math.min(availableInStorage, amount);
        if(actualAmount <= 0) {
            console.log(`房间 ${room.name} 的Storage中能量不足，无法转移到Terminal，需要: ${amount}，可用: ${availableInStorage}`);
            return;
        }
        
        if(actualAmount < amount) {
            console.log(`警告：房间 ${room.name} 的Storage中能量不足，只能转移 ${actualAmount}/${amount} 单位能量`);
        }
        
        // 在房间内存中创建运输任务
        if(!room.memory.terminalTasks) {
            room.memory.terminalTasks = [];
        }
        
        // 检查是否已有相同类型的任务
        const existingTask = _.find(room.memory.terminalTasks, task => 
            task.resource === RESOURCE_ENERGY && 
            task.from === 'storage' && 
            task.to === 'terminal'
        );
        
        if(existingTask) {
            // 更新现有任务的数量
            existingTask.amount += actualAmount;
            console.log(`房间 ${room.name} 更新了能量转移任务，从Storage转移 ${existingTask.amount} 单位到Terminal`);
        } else {
            // 添加新的运输任务
            room.memory.terminalTasks.push({
                id: Game.time.toString() + RESOURCE_ENERGY,
                type: 'transfer',
                resource: RESOURCE_ENERGY,
                amount: actualAmount,
                from: 'storage',
                to: 'terminal',
                priority: 2 // 高优先级
            });
            
            console.log(`房间 ${room.name} 创建了能量转移任务，从Storage转移 ${actualAmount} 单位到Terminal`);
        }
    },
    
    /**
     * 启用资源自动交易
     * @param {string} roomName - 房间名称
     * @param {string} resourceType - 资源类型
     * @param {number} minAmount - 保留的最小资源数量
     * @param {number} minPrice - 最低接受价格（可选）
     * @returns {string} - 操作结果信息
     */
    enableResourceTrading: function(roomName, resourceType, minAmount = 1000, minPrice = 0) {
        const room = Game.rooms[roomName];
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        if(!room.terminal) {
            return `错误：房间 ${roomName} 没有终端设施`;
        }
        
        // 初始化自动交易配置
        if(!room.memory.autoTrading) {
            room.memory.autoTrading = { enabled: false, resources: {} };
        }
        
        // 启用自动交易
        room.memory.autoTrading.enabled = true;
        
        // 配置资源交易
        room.memory.autoTrading.resources[resourceType] = {
            minAmount: minAmount
        };
        
        // 如果设置了最低价格
        if (minPrice > 0) {
            room.memory.autoTrading.resources[resourceType].minPrice = minPrice;
        }
        
        return `房间 ${roomName} 的${resourceType}自动交易已启用，保留最小数量: ${minAmount}${minPrice > 0 ? '，最低价格: ' + minPrice : ''}`;
    },
    
    /**
     * 禁用资源的自动交易
     * @param {string} roomName - 房间名称
     * @param {string} resourceType - 资源类型
     * @returns {string} - 操作结果信息
     */
    disableResourceTrading: function(roomName, resourceType) {
        const room = Game.rooms[roomName];
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        if(!room.memory.autoTrading) {
            return `房间 ${roomName} 没有配置自动交易`;
        }
        
        // 如果只想禁用特定资源交易
        if(room.memory.autoTrading.resources[resourceType]) {
            delete room.memory.autoTrading.resources[resourceType];
        } else {
            return `房间 ${roomName} 没有配置${resourceType}的自动交易`;
        }
        
        // 检查是否还有其他资源配置了自动交易
        if(Object.keys(room.memory.autoTrading.resources).length === 0) {
            room.memory.autoTrading.enabled = false;
        }
        
        return `房间 ${roomName} 的${resourceType}自动交易已禁用`;
    },
    
    /**
     * 启用K矿物的自动交易 (兼容旧API)
     * @param {string} roomName - 房间名称
     * @param {number} minAmount - 保留的最小K矿物数量
     * @returns {string} - 操作结果信息
     */
    enableKMineralTrading: function(roomName, minAmount = 1000) {
        return this.enableResourceTrading(roomName, RESOURCE_KEANIUM, minAmount);
    },
    
    /**
     * 禁用K矿物的自动交易 (兼容旧API)
     * @param {string} roomName - 房间名称
     * @returns {string} - 操作结果信息
     */
    disableKMineralTrading: function(roomName) {
        return this.disableResourceTrading(roomName, RESOURCE_KEANIUM);
    },
    
    /**
     * 获取房间所有已配置的自动交易资源
     * @param {string} roomName - 房间名称
     * @returns {string} - 操作结果信息
     */
    getConfiguredTradingResources: function(roomName) {
        const room = Game.rooms[roomName];
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        if(!room.memory.autoTrading || !room.memory.autoTrading.enabled) {
            return `房间 ${roomName} 未启用自动交易`;
        }
        
        const resources = room.memory.autoTrading.resources;
        if(Object.keys(resources).length === 0) {
            return `房间 ${roomName} 未配置任何资源的自动交易`;
        }
        
        let result = `房间 ${roomName} 已配置的自动交易资源:\n`;
        
        for(const resourceType in resources) {
            const config = resources[resourceType];
            result += `${resourceType}: 最小保留量=${config.minAmount}${config.minPrice ? ', 最低价格=' + config.minPrice : ''}\n`;
        }
        
        return result;
    },
    
    /**
     * 清除所有终端任务
     * @param {string} [roomName] - 可选，指定要清除任务的房间名称。如不指定则清除所有房间的终端任务
     * @returns {string} - 操作结果信息
     */
    clearAllTerminalTasks: function(roomName) {
        let clearedCount = 0;
        let roomsAffected = 0;
        
        // 如果指定了房间名称，只清除该房间的任务
        if(roomName) {
            const room = Game.rooms[roomName];
            if(!room) {
                return `错误：无法访问房间 ${roomName}`;
            }
            
            if(room.memory.terminalTasks && room.memory.terminalTasks.length > 0) {
                clearedCount = room.memory.terminalTasks.length;
                room.memory.terminalTasks = [];
                roomsAffected = 1;
                
                // 清除任何正在执行任务的terminalHauler的任务记忆
                this.clearCreepTaskMemory(room);
                
                return `已清除房间 ${roomName} 的所有终端任务 (${clearedCount} 个任务)`;
            } else {
                return `房间 ${roomName} 没有终端任务需要清除`;
            }
        } 
        // 如果没有指定房间，清除所有可见房间的任务
        else {
            for(const name in Game.rooms) {
                const room = Game.rooms[name];
                
                if(room.memory.terminalTasks && room.memory.terminalTasks.length > 0) {
                    clearedCount += room.memory.terminalTasks.length;
                    room.memory.terminalTasks = [];
                    roomsAffected++;
                    
                    // 清除任何正在执行任务的terminalHauler的任务记忆
                    this.clearCreepTaskMemory(room);
                }
            }
            
            if(roomsAffected > 0) {
                return `已清除 ${roomsAffected} 个房间的所有终端任务 (共 ${clearedCount} 个任务)`;
            } else {
                return `没有找到任何房间的终端任务需要清除`;
            }
        }
    },
    
    /**
     * 清除房间内所有terminal hauler的任务记忆
     * @param {Room} room - 房间对象
     */
    clearCreepTaskMemory: function(room) {
        const creeps = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'terminalHauler'
        });
        
        for(const creep of creeps) {
            if(creep.memory.taskId) {
                delete creep.memory.taskId;
                delete creep.memory.taskType;
                delete creep.memory.taskResource;
                delete creep.memory.taskAmount;
                delete creep.memory.taskFrom;
                delete creep.memory.taskTo;
                creep.say('🚫');
            }
        }
    },
    
    /**
     * 从市场上购买资源
     * @param {string} roomName - 发起购买的房间名称
     * @param {ResourceConstant} resourceType - 要购买的资源类型
     * @param {number} amount - 想要购买的数量
     * @param {number} maxPrice - 可接受的最高单价
     * @returns {string} - 操作结果信息
     */
    buyFromMarket: function(roomName, resourceType, amount, maxPrice) {
        const room = Game.rooms[roomName];
        if(!room) {
            return `错误：无法访问房间 ${roomName}`;
        }
        
        const terminal = room.terminal;
        if(!terminal) {
            return `错误：房间 ${roomName} 没有终端设施`;
        }
        
        if (!resourceType || !amount || amount <= 0 || !maxPrice || maxPrice <= 0) {
            return `错误：无效的参数。请提供资源类型、购买数量(>0)和最高价格(>0)`;
        }
        
        // 查找符合条件的出售订单
        const orders = Game.market.getAllOrders({
            type: ORDER_SELL,
            resourceType: resourceType
        });
        
        // 过滤价格过高的订单
        const affordableOrders = orders.filter(order => order.price <= maxPrice);
        
        if (affordableOrders.length === 0) {
            return `市场上没有找到价格低于 ${maxPrice} 的 ${resourceType} 出售订单。`;
        }
        
        // 按价格从低到高排序
        affordableOrders.sort((a, b) => a.price - b.price);
        
        let amountNeeded = amount;
        let totalBought = 0;
        let totalCreditsCost = 0;
        let totalEnergyCost = 0;
        let messages = [];
        
        console.log(`开始为房间 ${roomName} 购买 ${amount} 单位 ${resourceType}，最高价格 ${maxPrice}...`);
        
        // 遍历订单并尝试购买
        for (const order of affordableOrders) {
            if (amountNeeded <= 0) break; // 已买够
            
            const orderAmount = order.remainingAmount;
            if (orderAmount <= 0) continue; // 跳过空订单
            
            // 计算本次交易能买多少
            const buyAmount = Math.min(amountNeeded, orderAmount, terminal.store.getFreeCapacity(resourceType));
            
            if (buyAmount <= 0) {
                messages.push(`终端容量不足，无法继续购买 ${resourceType}`);
                break; // 终端满了
            }
            
            // 计算成本
            const creditsCost = buyAmount * order.price;
            const energyCost = Game.market.calcTransactionCost(buyAmount, roomName, order.roomName);
            
            // 检查资源
            if (Game.market.credits < creditsCost) {
                messages.push(`信用点不足以购买 ${buyAmount} ${resourceType} (需要 ${creditsCost.toFixed(2)})`);
                continue; // 信用点不够，尝试下一个订单
            }
            
            if (terminal.store[RESOURCE_ENERGY] < energyCost) {
                messages.push(`终端能量不足以支付交易费用 (需要 ${energyCost} 能量)`);
                // 尝试请求能量补充，但本次跳过
                this.requestEnergyTransfer(room, energyCost - terminal.store[RESOURCE_ENERGY]);
                continue; 
            }
            
            // 执行交易
            const result = Game.market.deal(order.id, buyAmount, roomName);
            
            if (result === OK) {
                amountNeeded -= buyAmount;
                totalBought += buyAmount;
                totalCreditsCost += creditsCost;
                totalEnergyCost += energyCost;
                messages.push(`成功从订单 ${order.id} 购买 ${buyAmount} ${resourceType} @ ${order.price} Credits/unit.`);
                console.log(`成功购买 ${buyAmount} ${resourceType} from ${order.roomName}, 耗费 ${creditsCost.toFixed(2)} Cr, ${energyCost} En.`);
            } else {
                messages.push(`尝试从订单 ${order.id} 购买 ${buyAmount} ${resourceType} 失败，错误: ${result}`);
                console.log(`购买失败 (订单 ${order.id}): ${result}`);
                // 如果是无效订单，可以考虑从内存中删除？但deal失败可能原因很多
            }
        }
        
        // 返回总结信息
        let summary = `购买 ${resourceType} 报告 (目标: ${amount}, 最高价: ${maxPrice}):\n`;
        summary += messages.join('\n');
        summary += `\n总计购买: ${totalBought} 单位`;
        summary += `\n总计花费: ${totalCreditsCost.toFixed(2)} Credits, ${totalEnergyCost} Energy`;
        summary += `\n剩余需求: ${amountNeeded} 单位`;
        
        return summary;
    }
};

global.managerTerminal = managerTerminal;
module.exports = managerTerminal;