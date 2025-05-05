import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.notificationsService.findAll(req.user);
  }

  @Post()
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Req() req: any,
  ) {
    return this.notificationsService.createNotification(
      req.user,
      createNotificationDto,
    );
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id, @Req() req: any) {
    console.log(id);
    return this.notificationsService.markAsRead(req.user, +id);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.remove(req.user, +id);
  }

  // @Post()
  // create(@Body() dto: CreateNotificationDto) {
  //   return this.notificationsService.createNotification(dto);
  // }

  // @Get(':userId')
  // getUserNotifications(@Param('userId') userId: number) {
  //   return this.notificationsService.getUserNotifications(userId);
  // }

  // @Patch(':id/read')
  // markAsRead(@Param('id') id: number) {
  //   return this.notificationsService.markAsRead(id);
  // }

  // @Delete(':id')
  // delete(@Param('id') id: number) {
  //   return this.notificationsService.deleteNotification(id);
  // }
}
