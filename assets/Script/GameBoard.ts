import { GameScene } from "./GameScene";
import { BrickNodePool } from "./NodePool";
import { BRICK_TYPE, BRICK_SIZE, ORIGIN_COLOR, MAP_WIDTH, MAP_HEIGHT } from "./BrickData";
import { GameMap } from "./GameMap";
import { GameConfig } from "./GameConfig";
import { GameBasic } from "./GameBasic";
import { ExBrick } from "./Brick/ExBrick";
import { Brick } from "./Brick/Brick";
import { AddBrick } from "./Brick/AddBrick";

/**
 * 砖块信息类
 */
export class BrickInf {
    public type: number = 0;
    public position: cc.Vec2 = null;
    public life: number = 0;
    public constructor(type: BRICK_TYPE, life: number) {
        this.type = type;
        this.position = cc.v2(0, 0);
        this.life = life;
    }
}

/**
 * 反射边枚举
 */
export enum SIDE {
    LEFT,
    TOP,
    RIGHT
}

/**
 * 反射点信息类
 */
export class Reflect {
    public reflectSide: SIDE = null;//用于记录反射边
    public position: cc.Vec2 = null;//用于记录反射坐标点
    public constructor(pos: cc.Vec2, ref: SIDE) {
        this.reflectSide = ref;
        this.position = pos;
    }
}

/**
 * 游戏棋盘数据处理
 */
export class GameBoard {

    public gameWidth: number = 720;
    public gameHeight: number = 1280;

    private brickStateArray: BrickInf[][] = null;
    private brickPosArray: cc.Vec2[][] = null;

    //private gameMap: GameMap = null;

    private boardWidth: number = 0;
    private boardHeight: number = 0;

    private correctValue: number = 10;

    public constructor() {
        this.init();
    }

    /**
     * 计算弹道的边界位置,没有结果将返回null
     * @param posA 球位置
     * @param posB 触控位置
     */
    public figureDestination(posA: cc.Vec2, posB: cc.Vec2): Reflect {
        if (Math.abs(posA.x - posB.x) < 0.05) {
            return;
        }
        let k: number = (posA.y - posB.y) / (posA.x - posB.x);
        let b: number = posA.y - k * posA.x;

        let sideA: number = -this.gameWidth / 2;
        let sideB: number = -sideA;
        let sideC: number = this.gameHeight / 2;

        let pointA: cc.Vec2 = cc.v2(sideA + this.correctValue, Math.floor(sideA * k + b));
        let pointB: cc.Vec2 = cc.v2(sideB - this.correctValue, Math.floor(sideB * k + b));
        let pointC: cc.Vec2 = cc.v2(Math.floor((sideC - b) / k), sideC - this.correctValue);

        let sideArray: cc.Vec2[] = [pointA, pointB, pointC];
        //修改判断顺序可以优化弹道
        if (posA.x > 0) {
            for (let i: number = 0; i < sideArray.length; i++) {
                if (this.isContain(sideArray[i])) {
                    //补充反射轨迹
                    switch (i) {
                        case 0:
                            return new Reflect(cc.v2(sideArray[i]), SIDE.LEFT);

                        case 1:
                            return new Reflect(cc.v2(sideArray[i]), SIDE.RIGHT);

                        case 2:
                            return new Reflect(cc.v2(sideArray[i]), SIDE.TOP);

                        default:
                            break;
                    }
                }
            }
        } else {
            for (let i: number = sideArray.length - 1; i >= 0; i--) {
                if (this.isContain(sideArray[i])) {
                    //补充反射轨迹
                    switch (i) {
                        case 0:
                            return new Reflect(cc.v2(sideArray[i]), SIDE.LEFT);

                        case 1:
                            return new Reflect(cc.v2(sideArray[i]), SIDE.RIGHT);

                        case 2:
                            return new Reflect(cc.v2(sideArray[i]), SIDE.TOP);

                        default:
                            break;
                    }
                }
            }
        }
        cc.log("没有焦点!");
        return null;
    }

    /**
     * 获取配置好的砖块节点
     * @param gameConfig 砖块配置器
     * @param brickNodePool 砖块结点池
     */
    public getBrickNodeArray(gameConfig: GameConfig, brickNodePool: BrickNodePool, gemaLevel: number): cc.Node[] {

        //先配置地图
        this.configMap(gameConfig, gemaLevel);
        let brickNodeArray: cc.Node[] = [];
        for (let i = 0; i < this.brickStateArray.length; i++) {
            for (let j = 0; j < this.brickStateArray[i].length; j++) {
                let bsa: BrickInf = this.brickStateArray[i][j];
                if (bsa.type != BRICK_TYPE.EMPTY) {
                    //第一次生成的节点应该采用颜色最深的纹理(0-10)
                    let temp: cc.Node = brickNodePool.getBrickNode(bsa.type);

                    if (!this.isExBrick(bsa.type)) {
                        //从这里插入生命值设定
                        temp.getComponent(Brick).init(bsa.life, ORIGIN_COLOR, bsa.type);
                        temp.getComponent(cc.Sprite).spriteFrame = gameConfig.getBlockSpriteFrame(bsa.type, ORIGIN_COLOR);
                        brickNodeArray.unshift(temp);
                    } else {
                        this.configExBrick(temp, bsa.type);
                        brickNodeArray.push(temp);
                    }
                    temp.position = bsa.position;
                }
            }
        }
        this.initStateArray();
        return brickNodeArray;
    }

    /**
     * 计算单位向量
     * @param vector 
     */
    public getUnitVec(vector: cc.Vec2): cc.Vec2 {
        let vecSize: number = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        let unitVec: cc.Vec2 = cc.v2(vector.x / vecSize, vector.y / vecSize);
        return unitVec;
    }

    /**
     *  计算弹道球位置信息，返回位置信息数组
     * */
    public figureBallOnLine(posA: cc.Vec2, posB: cc.Vec2): cc.Vec2[] {
        let sideA: number = posB.x - posA.x;
        let sideB: number = posB.y - posA.y;
        let absSideA: number = Math.abs(posA.x - posB.x);
        let absSideB: number = Math.abs(posA.y - posB.y);
        let distance: number = Math.sqrt(absSideA * absSideA + absSideB * absSideB);
        let count: number = Math.floor(distance / 40);
        //cc.log(count - 1);
        let ballPosArray: cc.Vec2[] = [];
        for (let i = 1; i < count; i++) {
            ballPosArray.push(cc.v2(posA.x + i * (sideA / count), posA.y + i * (sideB / count)));
        }
        return ballPosArray;
    }

    /**
     * 反射处理函数会直接对传入的数组进行操作并直接保存结果在当前数组中
     * @param posArray 
     * @param reflectPos 
     */
    public reflectDeal(posArray: cc.Vec2[], reflectPos: Reflect) {
        let length: number = posArray.length;
        let reflectLength: number = 3;
        if (length < reflectLength) {
            //轨迹小于3时不产生反射
            return;
        } else {
            let retArray: cc.Vec2[] = [];
            for (let i: number = 0; i < reflectLength; i++) {
                retArray[i] = cc.v2(posArray[length - i - 1]);
            }
            switch (reflectPos.reflectSide) {
                case SIDE.LEFT:
                case SIDE.RIGHT:
                    for (let i: number = 0; i < reflectLength; i++) {
                        retArray[i].y = reflectPos.position.y * 2 - retArray[i].y;
                    }
                    break;

                case SIDE.TOP:
                    for (let i: number = 0; i < reflectLength; i++) {
                        retArray[i].x = reflectPos.position.x * 2 - retArray[i].x;
                    }
                    break;

                default:
                    break;
            }
            //console.log(retArray.length);
            for (let i of retArray) {
                posArray.push(i);
            }
        }
    }

    public moveDown(nodeArray: cc.Node[]) {
        for (let i of nodeArray) {
            let act: cc.ActionInterval = cc.sequence(cc.moveTo(0.2, i.position.x, i.position.y - BRICK_SIZE), cc.callFunc(this.judgeOver, i));
            i.runAction(act);
        }
    }

    public judgeOver() {
        GameBasic.getInstance().notifyEvent("gameOver", this);
    }

    /**
     * 判断是否特效方块
     */
    public isExBrick(brickType: BRICK_TYPE): boolean {
        switch (brickType) {
            case BRICK_TYPE.SQUARE_DISMISS_ROW:
                return true;

            case BRICK_TYPE.SQUARE_DISMISS_COl:
                return true;

            case BRICK_TYPE.BALL_ADD:
                return true;

            default:
                return false;
        }
    }

    private init() {
        this.brickStateArray = [];
        this.brickPosArray = [];
        //棋盘设置宽高为11和20
        this.boardWidth = MAP_WIDTH;
        this.boardHeight = MAP_HEIGHT;
        this.correctValue = 10;
        //注意初始化的顺序不可变换
        this.initPosArray();
        this.initStateArray();

        //this.gameMap = new GameMap();
        //this.configMap();
    }

    /**
     * 配置特效砖块
     * @param node 
     * @param brickType 
     */
    private configExBrick(node: cc.Node, brickType: BRICK_TYPE) {
        switch (brickType) {
            case BRICK_TYPE.SQUARE_DISMISS_COl:
            case BRICK_TYPE.SQUARE_DISMISS_ROW:
                node.getComponent(ExBrick).init(brickType);
                break;

            case BRICK_TYPE.BALL_ADD:
                node.getComponent(AddBrick).init(brickType);
                break;


            default:
                console.log("特效砖块匹配出错!");
                break;
        }
    }

    /**
     * 砖块状态数组赋值初始化
     */
    private initStateArray() {
        for (let i = 0; i < this.boardHeight; i++) {
            this.brickStateArray[i] = [];
            for (let j = 0; j < this.boardWidth; j++) {
                let temp: BrickInf = new BrickInf(BRICK_TYPE.EMPTY, 0);
                this.brickStateArray[i][j] = temp;
                this.brickStateArray[i][j].type = BRICK_TYPE.EMPTY;
            }
        }
        //将事先计算完成的砖块真实坐标赋值给砖块状态数组
        for (let i = 0; i < this.boardHeight; i++) {
            for (let j = 0; j < this.boardWidth; j++) {
                this.brickStateArray[i][j].position = cc.v2(this.brickPosArray[i][j]);
            }
        }
    }

    /**
     * 计算砖块真实坐标
     */
    private initPosArray() {
        for (let i = 0; i < this.boardHeight; i++) {
            for (let j = 0; j < this.boardWidth; j++) {
                this.brickPosArray[i] = [];
            }
        }
        //先初始化一行一列
        this.brickPosArray[0][0] = cc.v2(BRICK_SIZE / 2, BRICK_SIZE / 2);
        //初始化第一列，用于对齐
        for (let i = 1; i < this.boardHeight; i++) {
            this.brickPosArray[i][0] = cc.v2(BRICK_SIZE / 2 + this.correctValue, this.brickPosArray[i - 1][0].y + BRICK_SIZE);
        }
        for (let i = 0; i < this.boardHeight; i++) {
            for (let j = 1; j < this.boardWidth; j++) {
                this.brickPosArray[i][j] = cc.v2(this.brickPosArray[i][j - 1].x + BRICK_SIZE,
                    this.brickPosArray[i][j - 1].y);
            }
        }
        //对齐原点
        for (let i of this.brickPosArray) {
            for (let j of i) {
                j.subSelf(cc.v2(this.gameWidth / 2, this.gameHeight / 2));
            }
        }
    }

    /**
     * 配置地图
     */
    private configMap(gameConfig: GameConfig, gameLevel: number) {
        //获取地图
        let maze: BrickInf[][] = gameConfig.getGameMap(gameLevel);
        for (let i = 0; i < this.brickStateArray.length; i++) {
            for (let j = 0; j < this.brickStateArray[i].length; j++) {
                //let test: BrickInf = maze[i][j];
                if (maze[i][j] != undefined) {
                    this.brickStateArray[i][j].type = maze[i][j].type;
                    this.brickStateArray[i][j].life = maze[i][j].life;
                }
            }
        }
    }

    /**
     * 判断点是否在画面内
     * @param pos 
     */
    private isContain(pos: cc.Vec2): boolean {
        if (pos.x > -this.gameWidth / 2
            && pos.y > -this.gameHeight / 2
            && pos.x < this.gameWidth / 2
            && pos.y < this.gameHeight / 2) {
            return true;
        } else {
            return false;
        }
    }
}
